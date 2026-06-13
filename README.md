# NowCart — Reimagining Urgent Shopping

> "Quick commerce solved delivery. We solve the deciding."

NowCart is an **intent-capture layer** on top of quick-commerce. Instead of a search box, it offers
multiple "front doors" into one intelligent engine: **speak it, constrain it, show it, or share it** —
and a confident, ready-to-checkout cart just appears.

Built for **HackOn with Amazon** — theme *"Reimagine Shopping Experience — Delivery is fast. Shopping isn't."*

---

## Features (locked scope)

| Code | Feature | Front door / Layer |
|------|---------|--------------------|
| A1 | Outcome Engine (recipe/task → cart) | Backbone (LangGraph multi-agent) |
| A2 | Voice-to-Order (full conversational loop) | Front door — speak it |
| A3 | Constraint-first ordering ("₹500, dinner for 4") | Front door — constrain it |
| B2 | Photo → recreate-at-home (dish image → cart) | Front door — show it |
| B4 | Share-to-Order (recipe link/text → cart) | Front door — share it |
| C2+C3 | Comparison collapse + confidence score | Trust layer |
| D2 | Substitution intelligence (out-of-stock → smart swap) | Resilience layer |
| D4 | SOS / Emergency mode | Speed layer |

## Tech Stack (strictly AWS free tier)

- **Frontend:** React + Vite + TypeScript (Nest grocery theme)
- **Backend:** FastAPI + Pydantic, MVC (controllers / middleware / services / repositories), async
- **Agents:** LangGraph multi-agent DAG with human-in-the-loop confidence gates
- **LLM:** Groq (fast text) + Gemini (vision) behind a swappable `LLMProvider` interface (Bedrock = production target)
- **DB:** DynamoDB (DynamoDB Local for dev) — always-free tier
- **Cache/State:** Redis (Docker on EC2) — cart, sessions, LLM cache
- **Load balancing:** Nginx on EC2 (not paid ALB)
- **Async jobs:** Lambda + SQS
- **Data:** curated real grocery catalog + deterministic mock users/orders/stock

## Repo layout

```
VoiceShop/
├── server/          FastAPI backend (MVC + LangGraph agents)
├── client/          React + TypeScript frontend (Nest theme)
├── data/            Catalog seed + mock data + seed scripts
└── README.md
```

## Quick start (Docker Compose)

```bash
docker compose up --build
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000
# Health:    http://localhost:8000/health
```

This starts the full stack: FastAPI backend, React frontend (nginx), Redis, and DynamoDB Local.

## Quick start (without Docker)

```bash
# Backend (uv manages the venv + deps)
cd server
uv sync                      # creates .venv and installs from pyproject.toml
copy .env.example .env       # fill GROQ_API_KEY / GEMINI_API_KEY (optional; mock works keyless)
uv run python -m app.seed    # seed catalog into DynamoDB Local (or in-memory fallback)
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd client
npm install
npm run dev
```

See `server/README.md` and `client/README.md` for details.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production deployment notes covering:
- S3 + CloudFront (static frontend)
- EC2 + Nginx (API server + Redis)
- DynamoDB (persistent data)
- Lambda + SQS (async tasks)

All services stay within the AWS free tier.
