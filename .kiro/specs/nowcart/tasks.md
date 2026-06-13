# Implementation Plan — NowCart

## Overview

Incremental build: scaffolding and contracts, then data + LangGraph Outcome Engine (backbone),
then services, REST API, and the React/TS frontend (Nest theme). The app always runs end-to-end with
`MockProvider` + in-memory backend (no keys, no AWS); Groq/Gemini/DynamoDB are `.env`-only upgrades.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "depends_on": [] },
    { "wave": 2, "tasks": ["2"], "depends_on": ["1"] },
    { "wave": 3, "tasks": ["3"], "depends_on": ["2"] },
    { "wave": 4, "tasks": ["4"], "depends_on": ["3"] },
    { "wave": 5, "tasks": ["5"], "depends_on": ["4"] },
    { "wave": 6, "tasks": ["6"], "depends_on": ["5"] },
    { "wave": 7, "tasks": ["7"], "depends_on": ["6"] },
    { "wave": 8, "tasks": ["8"], "depends_on": ["7"] }
  ]
}
```

## Tasks

- [x] 1. Foundation: app entry, models, LLM providers (keep simple — controllers, services, middleware only where needed; no abstract factories or unnecessary layers)
  - [x] 1.1 Repo structure, requirements.txt, .env.example, config, logging
  - [x] 1.2 FastAPI app (CORS, health, routers) + domain/DTO Pydantic models — flat folder layout: `controllers/`, `services/`, `models/` (domain + dto), `middleware/` only for PII/rate-limit. No nested abstractions.
  - [x] 1.3 LLMProvider/VisionProvider interface + Mock/Groq/Gemini + factory — one `llm/` folder with a simple provider protocol, concrete implementations, and a `get_provider()` selector (no registry pattern, no plugin system).
  - _Requirements: 9.1, 9.2, 9.6, 4.1, 4.5_

- [ ] 2. Data layer + seed
  - [ ] 2.1 Repository interface, in-memory store, DynamoDB repo; Redis cache + memory fallback
  - [ ] 2.2 Curated BigBasket catalog seed + deterministic mock users/orders/stock
  - [ ] 2.3 Seed script `python -m app.seed`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.3_

- [ ] 3. Catalog service + matching
  - [ ] 3.1 catalog_service: search, category filter, availability with stock override
  - [ ] 3.2 Fuzzy + category matching (rapidfuzz) need → product candidates
  - _Requirements: 1.2, 1.3, 8.3_

- [ ] 4. LangGraph Outcome Engine (A1 backbone)
  - [ ] 4.1 AgentState + nodes: intent, decompose, match, optimize, substitute, confidence
  - [ ] 4.2 Graph wiring with out-of-stock conditional edge + HITL gate; outcome_service persists cart
  - _Requirements: 1.1–1.6, 5.x, 6.x_

- [ ] 5. Supporting services (front doors + trust/resilience)
  - [ ] 5.1 confidence (C2/C3) + substitution (D2)
  - [ ] 5.2 budget/constraint-first (A3), sos (D4), cart ops (voice follow-ups)
  - _Requirements: 2.3, 2.4, 3.x, 5.x, 6.x, 7.x_

- [ ] 6. REST API + middleware
  - [ ] 6.1 Controllers: outcome, voice intent, constraint, vision, share, cart op, sos, catalog, admin stock
  - [ ] 6.2 Middleware: PII redaction, rate limit, request id
  - _Requirements: 1.x, 2.x, 3.x, 4.x, 7.x, 8.3, 9.5_

- [ ] 7. Frontend (React + Vite + TS, Nest theme)
  - [ ] 7.1 Scaffold + Tailwind theme + typed API client + layout (header, sidebar, grid)
  - [ ] 7.2 Front-door composer (text/budget/voice), voice flow, photo + share input
  - [ ] 7.3 Cart drawer (confidence + substitution), comparison-collapse card, SOS screen
  - _Requirements: 1.x–7.x, 9.6_

- [ ] 8. Verify + deploy
  - [ ] 8.1 Tests (confidence, budget, matching, substitution) + agent e2e + seed check
  - [ ] 8.2 Dockerfile + compose (Redis, DynamoDB Local); S3/CloudFront + EC2/Nginx + Lambda/SQS notes
  - _Requirements: all, 9.3, 9.4_

## Notes

- Baseline demo runs with `DATA_BACKEND=memory`, `LLM_TEXT_PROVIDER=mock`, `LLM_VISION_PROVIDER=mock`.
- Keep controllers thin; logic in services (testable, microservice-ready).
- Stock overrides + deterministic mock orders make live demos repeatable.
- Bedrock/ALB/ElastiCache appear only in the production diagram, never in the running prototype (free tier).
