# NowCart

> Quick commerce solved delivery. We solve the deciding.

NowCart turns a plain need into a checkout-ready cart. Say a meal, snap a dish photo, paste a recipe link, set a budget, or let it predict your restock — one AI engine handles the rest.

**[Live App](https://d2hj5yrm8sue4v.cloudfront.net)** · Sign in as `rahul@gmail.com` (any password) for the full experience with order history and predictions.

---

## How it works

Five entry points, one reasoning engine:

| | Input | What the engine does |
|---|---|---|
| **Show** | Dish photo | Gemini Vision extracts ingredients → maps to catalog |
| **Share** | Recipe link or YouTube URL | Fetches + parses content → builds ingredient cart |
| **Speak** | Voice or text ("biryani for 4") | Decomposes intent → semantic + fuzzy match → confidence-scored cart |
| **Constrain** | Budget + headcount | Full pipeline → greedy knapsack trims to budget |
| **Subscribe** | Recurring items or nothing | Analyses order history → predicts restock before you ask |

Every cart returns a **recommended pick** and a **cheaper alternative** per item, with confidence scores and a NowCart Verified badge on the highest-rated, most-ordered products.

---

## Architecture

<details>
<summary>System diagram</summary>

```mermaid
flowchart TB
    subgraph L1["① Feature Layer"]
        FD["Share · Show · Speak · Constrain · Subscribe"]
    end

    subgraph L2["② Security & Capture — FastAPI"]
        CAP["Vision API · JSON-LD fetch · Speech-to-Text · Budget parser"]
        SEC["SSRF guard · Rate limiting · Input sanitization"]
    end

    subgraph L3["③ Decision"]
        DEC{"Needs cart assembly?"}
    end

    subgraph L4["④ Engine Layer"]
        ENG["Outcome Engine — Decompose → Match → Optimize → Confidence"]
        RET["Retrieval Pipeline\n① Bi-encoder  ② Cross-encoder  ③ Rapidfuzz\n→ Verified badge picks"]
        LLM["Groq LLM — region-aware reasoning"]
        OOS["Out-of-stock handler — suggests alternative, user decides"]
    end

    subgraph L5["⑤ Storage"]
        STR[("DynamoDB — products · users · orders\nRedis — cart · sessions · LLM cache")]
    end

    subgraph L6["⑥ One Confident Cart"]
        CART["Best pick · Economical alternative · Verified badge · Confidence % + reasoning"]
    end

    subgraph L7["⑦ Checkout"]
        CHK["Place Order → Payment → Confirmed → Storage"]
    end

    FD --> CAP --> SEC --> DEC
    DEC -->|"assemble cart"| ENG
    DEC -->|"exact product"| CART
    ENG <--> RET
    ENG <--> LLM
    ENG <--> STR
    RET <--> STR
    RET -.->|out of stock| OOS
    OOS -.-> CART
    ENG --> CART
    CART -.->|refine| ENG
    CART --> CHK
    CHK --> STR
    CHK -.->|order history feeds predictions| FD
```

</details>

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS 4 · PWA (installable) |
| Backend | FastAPI + Pydantic 2 · Python 3.12 · fully async |
| AI / ML | LangGraph · Groq Llama 3.3 70B · Gemini 2.0 Flash · Bedrock Claude 3 Haiku · rapidfuzz |
| Database | DynamoDB (on-demand) |
| Cache | Redis — cart state, sessions, LLM response cache (1-hr TTL) |
| Infra | EC2 + Nginx · S3 + CloudFront · AWS ap-south-1 |
| CI/CD | GitHub Actions — push to `master` auto-deploys frontend to S3/CloudFront and backend to EC2 |

---

## Running locally

**Backend**

```bash
cd server
pip install -r requirements.txt

# No API keys needed — runs fully in-memory with mock LLM
uvicorn app.main:app --reload --port 8000
```

To use real AI, set these in `server/.env`:

```env
LLM_TEXT_PROVIDER=groq
LLM_VISION_PROVIDER=gemini
GROQ_API_KEY=...
GEMINI_API_KEY=...
DATA_BACKEND=memory        # or dynamodb
REDIS_URL=redis://localhost:6379/0
```

**Frontend**

```bash
cd client
npm install
npm run dev    # http://localhost:5173 — proxies /api → :8000
```

---

## Deployment

Push to `master` triggers the GitHub Actions pipeline:

1. Build frontend (`tsc + vite`) → sync to S3 → invalidate CloudFront
2. SSH into EC2 → `git pull` → `systemctl restart nowcart`

Required secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.

---

## Admin

Log in as `admin@nowcart.app` (any password) to see request volume, cart-build count, latency, error rate, LLM cache hit ratio, and infrastructure cost (currently $0 — free tier).
