# NowCart — Deployment Guide

## Local Development (Docker Compose)

```bash
# Start the full stack (backend + frontend + Redis + DynamoDB Local)
docker compose up --build

# Access points:
#   Frontend:  http://localhost:3000  (nginx, proxies /api to backend)
#   Backend:   http://localhost:8000  (direct FastAPI access)
#   Redis:     localhost:6379
#   DynamoDB:  localhost:8001
```

### Running without Docker

```bash
# Backend
cd server
cp .env.example .env          # edit as needed
uv run python -m app.seed     # seed catalog (optional — auto-seeds on startup for memory backend)
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :8000)
```

### Environment Modes

| Mode | `DATA_BACKEND` | `CACHE_IN_MEMORY` | `LLM_TEXT_PROVIDER` | External deps |
|------|---------------|-------------------|---------------------|---------------|
| Zero-dep demo | `memory` | `true` | `mock` | None |
| Docker Compose | `dynamodb` | `false` | `mock` | Redis + DynamoDB Local (containers) |
| Production | `dynamodb` | `false` | `groq` | AWS DynamoDB + Redis on EC2 |

---

## Production Architecture (AWS Free Tier Only)

All services below are within the AWS Free Tier. No paid ALB, ElastiCache, or Bedrock.

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFRONT CDN                            │
│           (static frontend assets from S3 bucket)           │
└─────────────┬───────────────────────────────────────────────┘
              │ /api/* → EC2 origin
              │ /*     → S3 origin
              ▼
┌─────────────────────────────────────────────────────────────┐
│  EC2 t2.micro (750 hrs/mo free for 12 months)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  NGINX (reverse proxy)                  │ │
│  │   /api/*  →  uvicorn :8000  (FastAPI)                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │  Uvicorn     │  │  Redis (redis-server on same box)    │ │
│  │  (FastAPI)   │  │  (cart/session/cache — no            │ │
│  │              │  │   ElastiCache needed for prototype)   │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌────────────┐  ┌─────────────┐
     │  DynamoDB    │  │    SQS     │  │   Lambda    │
     │ (25 GB free) │  │ (1M req/mo)│  │ (1M req/mo) │
     └──────────────┘  └────────────┘  └─────────────┘
```

---

## S3 + CloudFront (Static Frontend)

Hosts the Vite/React production build as a static site behind CloudFront.

### Setup

1. **Create an S3 bucket** (e.g. `nowcart-frontend`):
   - Block all public access (CloudFront uses OAI/OAC).
   - Enable static website hosting.

2. **Build and upload**:
   ```bash
   cd client
   npm run build
   aws s3 sync dist/ s3://nowcart-frontend --delete
   ```

3. **Create a CloudFront distribution**:
   - Default origin → S3 bucket (with OAC).
   - Add a second origin → EC2 public IP/DNS for `/api/*`.
   - Behavior: `/api/*` → EC2 origin (no caching, all methods).
   - Behavior: `/*` → S3 origin (cache 1 day, compress).
   - Error pages: 403/404 → `/index.html` (SPA routing).

4. **Invalidate on deploy**:
   ```bash
   aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
   ```

### Free Tier Limits
- S3: 5 GB storage, 20K GET, 2K PUT/month.
- CloudFront: 1 TB transfer out, 10M requests/month.

---

## EC2 + Nginx (API Server)

Single `t2.micro` instance runs Nginx (reverse proxy), Uvicorn (FastAPI), and Redis.

### Instance Setup

```bash
# Amazon Linux 2023 / Ubuntu 22.04
sudo dnf install nginx redis6 python3.11 -y  # or apt install
sudo systemctl enable --now nginx redis6

# Install uv + deploy backend
curl -LsSf https://astral.sh/uv/install.sh | sh
cd /opt/nowcart/server
uv venv && uv pip install .
uv run python -m app.seed  # create DynamoDB tables + seed data
```

### Nginx Configuration

```nginx
# /etc/nginx/conf.d/nowcart.conf
upstream nowcart_api {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.nowcart.example.com;

    # API reverse proxy
    location / {
        proxy_pass http://nowcart_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (for CloudFront origin health)
    location = /health {
        proxy_pass http://nowcart_api;
        access_log off;
    }
}
```

### Systemd Service

```ini
# /etc/systemd/system/nowcart.service
[Unit]
Description=NowCart FastAPI Backend
After=network.target redis6.service

[Service]
Type=simple
User=nowcart
WorkingDirectory=/opt/nowcart/server
EnvironmentFile=/opt/nowcart/server/.env
ExecStart=/opt/nowcart/server/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nowcart
```

### Environment Variables (Production)

```bash
# /opt/nowcart/server/.env
APP_ENV=production
DATA_BACKEND=dynamodb
AWS_REGION=ap-south-1
REDIS_URL=redis://127.0.0.1:6379/0
CACHE_IN_MEMORY=false
LLM_TEXT_PROVIDER=groq
LLM_VISION_PROVIDER=gemini
GROQ_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
CONFIDENCE_THRESHOLD=0.7
CORS_ORIGINS=https://your-cloudfront-domain.cloudfront.net
```

### Security Group (EC2)

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP | SSH |
| 80 | 0.0.0.0/0 | HTTP (Nginx) |
| 443 | 0.0.0.0/0 | HTTPS (with certbot/ACM) |

### Free Tier Limits
- EC2 t2.micro: 750 hours/month (1 instance always-on for 12 months).
- 30 GB EBS gp2 storage included.

---

## DynamoDB (Persistent Data Store)

### Tables

| Table | Partition Key | Sort Key | GSI |
|-------|--------------|----------|-----|
| `Products` | `product_id` | — | `category-index` (category → product_id) |
| `Users` | `user_id` | — | — |
| `Orders` | `user_id` | `order_date` | — |

Tables are created automatically by the seed script when `DATA_BACKEND=dynamodb`.

### Free Tier Limits
- 25 GB storage.
- 25 WCU + 25 RCU (on-demand mode: 25K read/write units per month).
- Sufficient for prototype traffic (~500 products, light demo usage).

### Production Notes
- Remove `DYNAMODB_ENDPOINT` from `.env` to use real AWS DynamoDB.
- IAM role on EC2 provides credentials (no access keys needed in production).

---

## Lambda + SQS (Async Tasks)

For heavy/slow operations that would block API responses at scale.

### Architecture

```
API endpoint → SQS Queue → Lambda Function → DynamoDB (result)
                                ↓
                    Frontend polls GET /api/cart/{session}
```

### Job Definitions

| Job | SQS Queue | Lambda Handler | Trigger |
|-----|-----------|---------------|---------|
| Image analysis | `nowcart-vision-queue` | `lambda_vision.handler` | Photo upload via `/api/vision/photo` |
| Recipe parsing | `nowcart-share-queue` | `lambda_share.handler` | Share link via `/api/share` |
| LLM cache warm | — (scheduled) | `lambda_warmup.handler` | CloudWatch Events cron |

### Lambda Configuration

```yaml
# Each Lambda function:
Runtime: python3.11
MemorySize: 256  # MB
Timeout: 30      # seconds
Environment:
  GEMINI_API_KEY: <from Secrets Manager>
  DYNAMODB_TABLE: Products
```

### SQS Configuration

```yaml
# Each queue:
VisibilityTimeout: 60   # seconds (> Lambda timeout)
MessageRetention: 86400 # 1 day
DeadLetterQueue:
  maxReceiveCount: 3    # retry 3 times, then DLQ
```

### Deployment

```bash
# Package Lambda function
cd server
zip -r lambda_vision.zip app/llm/ app/services/vision_service.py app/models/

# Create function
aws lambda create-function \
  --function-name nowcart-vision \
  --runtime python3.11 \
  --handler lambda_vision.handler \
  --zip-file fileb://lambda_vision.zip \
  --role arn:aws:iam::ACCOUNT:role/nowcart-lambda-role

# Wire SQS trigger
aws lambda create-event-source-mapping \
  --function-name nowcart-vision \
  --event-source-arn arn:aws:sqs:ap-south-1:ACCOUNT:nowcart-vision-queue \
  --batch-size 1
```

### Free Tier Limits
- Lambda: 1M requests/month, 400K GB-seconds compute.
- SQS: 1M requests/month.

### Prototype Note
For the hackathon demo, all async work runs synchronously in the FastAPI process.
Lambda/SQS is the production scaling path when request volume exceeds single-instance capacity.

---

## Deployment Checklist

### Prerequisites
- [ ] AWS account (free tier eligible)
- [ ] Domain name (optional — can use CloudFront URL directly)
- [ ] Groq API key (free at [console.groq.com](https://console.groq.com))
- [ ] Gemini API key (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Steps

1. **Provision EC2** — `t2.micro`, Amazon Linux 2023, security group (80, 443, 22).
2. **Install runtime** — Python 3.11, Nginx, Redis, uv.
3. **Deploy backend** — Clone repo → `cd server` → `uv pip install .` → seed → start systemd service.
4. **Configure Nginx** — Proxy all traffic to uvicorn, enable HTTPS (certbot).
5. **Create DynamoDB tables** — Run seed with `DATA_BACKEND=dynamodb`.
6. **Build frontend** — `cd client && npm run build`.
7. **Upload to S3** — `aws s3 sync dist/ s3://nowcart-frontend --delete`.
8. **Create CloudFront distribution** — S3 origin (default) + EC2 origin (`/api/*`).
9. **Set environment variables** — In `/opt/nowcart/server/.env` (see above).
10. **Verify** — `curl https://<cloudfront-domain>/health` → `{"status":"ok"}`.

---

## Cost Summary (AWS Free Tier)

| Service | Free Tier Allocation | NowCart Usage |
|---------|---------------------|---------------|
| EC2 (t2.micro) | 750 hrs/month × 12 months | 1 instance, always-on |
| EBS (gp2) | 30 GB | ~8 GB (OS + app + Redis data) |
| S3 | 5 GB, 20K GET, 2K PUT/mo | ~10 MB static assets |
| CloudFront | 1 TB transfer, 10M requests/mo | Minimal demo traffic |
| DynamoDB | 25 GB, 25 WCU/RCU | ~500 products + orders |
| Lambda | 1M requests, 400K GB-sec/mo | Async jobs (low volume) |
| SQS | 1M requests/mo | Job queuing |

**Total monthly cost for prototype: $0** (within free tier limits for 12 months).

---

## Security Notes

- No secrets baked into Docker images — use environment variables or AWS Secrets Manager.
- PII redaction middleware runs on every request before external LLM calls.
- Uploaded images are processed in-memory only, never persisted to disk.
- For production hardening: add API Gateway with auth, WAF rules, and VPC isolation.
- Redis is bound to `127.0.0.1` on EC2 (not exposed externally).
- DynamoDB access controlled via IAM role attached to EC2 instance profile.
