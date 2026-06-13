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
    { "wave": 8, "tasks": ["8"], "depends_on": ["6", "7"] },
    { "wave": 9, "tasks": ["9"], "depends_on": ["7", "8"] }
  ]
}
```

## Tasks

- [x] 1. Foundation: app entry, models, LLM providers (keep simple — controllers, services, middleware only where needed; no abstract factories or unnecessary layers)
    - [x] 1.1 Repo structure, pyproject.toml, .env.example, config, logging
    - [x] 1.2 FastAPI app (CORS, health, routers) + domain/DTO Pydantic models — flat folder layout: `controllers/`, `services/`, `models/` (domain + dto), `middleware/` only for PII/rate-limit. No nested abstractions.
    - [x] 1.3 LLMProvider/VisionProvider interface + Mock/Groq/Gemini + factory — one `llm/` folder with a simple provider protocol, concrete implementations, and a `get_provider()` selector (no registry pattern, no plugin system).
    - _Requirements: 9.1, 9.2, 9.6, 4.1, 4.5_

- [x] 2. Data layer + seed
    - [x] 2.1 Repository interface, in-memory store, DynamoDB repo; Redis cache + memory fallback
    - [x] 2.1v **Verify**: import repositories, instantiate in-memory store, confirm CRUD ops pass (`uv run python -c "from app.repositories import ..."`)
    - [x] 2.2 Curated grocery catalog seed + deterministic mock users/orders/stock
    - [x] 2.2v **Verify**: run seed load and confirm product count, user count, and stock overrides are correct
    - [x] 2.3 Seed script `uv run python -m app.seed`
    - [x] 2.3v **Verify**: run `uv run python -m app.seed` end-to-end; confirm exit 0, expected product count loaded, and app starts with `DATA_BACKEND=memory`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.3_

- [x] 3. Catalog service + matching
    - [x] 3.1 catalog_service: search, category filter, availability with stock override
    - [x] 3.1v **Verify**: run app, hit `/api/catalog/search?q=rice` and `/api/catalog/search?category=Staples`, confirm results
    - [x] 3.2 Fuzzy + category matching (rapidfuzz) need → product candidates
    - [x] 3.2v **Verify**: unit test fuzzy matching with known inputs (e.g. "basmati rice" → matches "Basmati Rice 1kg")
    - _Requirements: 1.2, 1.3, 8.3_

- [x] 4. LangGraph Outcome Engine (A1 backbone)
    - [x] 4.1 AgentState + nodes: intent, decompose, match, optimize, substitute, confidence
    - [x] 4.1v **Verify**: instantiate graph nodes individually with mock state; confirm each node transforms state correctly
    - [x] 4.2 Graph wiring with out-of-stock conditional edge + HITL gate; outcome_service persists cart
    - [x] 4.2v **Verify**: run full graph end-to-end with MockProvider input "Biryani for 4"; confirm cart is returned with items
    - _Requirements: 1.1–1.6, 5.x, 6.x_

- [x] 5. Supporting services (front doors + trust/resilience)
    - [x] 5.1 confidence (C2/C3) + substitution (D2)
    - [x] 5.1v **Verify**: unit test confidence scoring returns 0–1; substitution picks an in-stock alternative when primary is OOS
    - [x] 5.2 budget/constraint-first (A3), sos (D4), cart ops (voice follow-ups)
    - [x] 5.2v **Verify**: budget service returns cart ≤ budget; SOS returns a kit; cart ops (add/remove) mutate cart correctly
    - [x] 5.3 Goal-based shopping: user states a goal (e.g. "I want to lose weight") → AI decomposes into relevant product needs (oats, protein-rich snacks, fruits) and builds a cart. Adds GOAL IntentMode, goal-aware decompose prompt, mock goal book for deterministic demos.
    - [x] 5.3v **Verify**: run full graph with MockProvider input "I want to lose weight"; confirm cart is returned with health-focused items (oats, protein snacks, fruits)
    - _Requirements: 2.3, 2.4, 3.x, 5.x, 6.x, 7.x_

- [x] 6. REST API + middleware
    - [x] 6.1 Controllers: outcome, voice intent, constraint, vision, share, cart op, sos, catalog, admin stock
    - [x] 6.1v **Verify**: start server, POST `/api/outcome` with `{"text":"Biryani for 4"}`, confirm 200 + cart JSON
    - [x] 6.2 Middleware: PII redaction, rate limit, request id
    - [x] 6.2v **Verify**: send request with PII in body, confirm it's redacted in logs; confirm rate limit header present
    - _Requirements: 1.x, 2.x, 3.x, 4.x, 7.x, 8.3, 9.5_

- [x] 7. Frontend (React + Vite + TS, Nest theme)
    - [x] 7.1 Scaffold + Tailwind theme + typed API client + layout (header, sidebar, grid)
    - [x] 7.1v **Verify**: `npm run build` succeeds; dev server starts; layout renders in browser
    - [x] 7.2 Front-door composer (text/budget/voice), voice flow, photo + share input
    - [x] 7.2v **Verify**: type an outcome in composer, confirm API call fires and cart appears
    - [x] 7.3 Cart drawer (confidence + substitution), comparison-collapse card, SOS screen
    - [x] 7.3v **Verify**: cart drawer opens with items; confidence chips visible; SOS mode triggers emergency UI
    - _Requirements: 1.x–7.x, 9.6_

- [x] 8. Frontend Revamp & Backend Sync (experience layer: "four ways in, one brain, one confident cart out")
    - [x] 8.1 Design system + Front Door Hub landing:
        - Theme tokens (color/type/spacing), shared UI primitives (Button, Card, Chip, Panel, Spinner, Toast/empty/error), transition wrappers.
        - Responsive mobile/tablet/desktop; accessible (keyboard focus rings, contrast ≥ 4.5:1). Refactor Header/Footer/ProductCard/CartDrawer/Composer onto it.
        - Rebuild HomePage as Front Door Hub: thesis + "four ways in, one brain, one cart" narrative; four distinct front-door entry points opening panels client-side (no reload); empty state explaining the flow; single-column on mobile.
    - [x] 8.1v **Verify**: build + dev server OK; tokens applied; every control tab-focusable; contrast ≥ 4.5:1; no overflow at mobile/tablet/desktop; thesis + narrative + four distinct doors visible; door opens panel without reload; empty state pre-activation; single-column on mobile.
    - _Requirements: 10_

    - [x] 8.2 Four front-door panels with loading/empty/error states:
        - Speak (`voice/intent`): listening/transcription/processing/confirming states, spoken-or-typed follow-ups, mic-denied fallback to typed input.
        - Constrain (`constraint`): total + remaining budget, closest-cart + labeled shortfall, inline validation for empty/non-numeric (no engine call).
        - Show (`vision/photo`): image preview, processing, dish + cart, degraded fallback to typed input, discard image at session end.
        - Share (`share`): loading, extracted cart, parse-error fallback to typed input, source indicator (link/pasted text).
    - [x] 8.2v **Verify**: each panel yields a cart; voice cycles listening→processing→confirming + mic-denied fallback; constraint shows total/remaining + blocks non-numeric inline; photo previews + degrades; share shows source + handles parse errors.
    - _Requirements: 10_

    - [x] 8.3 Confident cart + substitution:
        - Single primary cart from any door; per-item confidence chip (score + one-line why); comparison-collapse card with expandable reasoning trail; HITL clarifying prompt when below threshold; per-item price/confidence/substitution + total.
        - Substitution notices: original → substitute + reason; substituted items visually distinct from direct matches; unmatched items flagged.
    - [x] 8.3v **Verify**: single cart per door; chips with score + reason; reasoning trail expands; low-confidence pick shows HITL prompt; per-item price/confidence/substitution + total render; force OOS via `admin/stock` → notice (original → substitute + reason) renders; substituted items distinct; unmatched item flagged.
    - _Requirements: 10_

    - [x] 8.4 SOS UI + backend sync:
        - SOS UI: prominent one-tap entry app-wide; emergency UI with urgency indicator + ETA countdown; labeled fastest-delivery in-stock items; ≤ 2-step checkout. Rebuild SosPage on the design system.
        - Backend sync: expose staged voice states, reasoning trail, SOS ETA/countdown, remaining budget (update Pydantic DTOs); regenerate TS types from OpenAPI (`openapi-typescript`) and refactor `client/src/api/client.ts` to consume them (no drift).
        - Wire all endpoints (outcome, voice/intent, constraint, vision/photo, share, cart/op, cart/{session}, sos, catalog/search, admin/stock) to their doors; every panel shows a descriptive error/degraded state.
    - [x] 8.4v **Verify**: one-tap SOS activates; urgency + ETA countdown show; fastest-delivery items labeled; checkout ≤ 2 steps; backend exposes staged voice states/reasoning trail/SOS ETA-countdown/remaining budget; TS types compile with no drift; client.ts uses generated types; each endpoint drives its door; endpoint error shows descriptive degraded state.
    - _Requirements: 10_

    - [x] 8.5 Final integration checkpoint — Ensure all tests pass, ask the user if questions arise.
        - Build + dev server run; each door (Speak/Constrain/Show/Share) produces a cart; chips visible; SOS triggers; substitution renders; responsive + keyboard-accessible end to end.
    - [x] 8.5v **Verify**: build + dev server run; each door produces a cart; chips visible; SOS triggers; substitution renders; responsive + keyboard-accessible end to end.
    - _Requirements: 10_

- [~] 9. Verify + deploy
    - [~] 9.1 Tests (confidence, budget, matching, substitution) + agent e2e + seed check
    - [~] 9.1v **Verify**: full test suite passes (`uv run pytest` / `npm test`); no failures
    - [~] 9.2 Dockerfile + compose (Redis, DynamoDB Local); S3/CloudFront + EC2/Nginx + Lambda/SQS notes
    - [ ] 9.2v **Verify**: `docker compose up` starts all services; health endpoint responds 200
    - _Requirements: all, 9.3, 9.4_

## Notes

- Baseline demo runs with `DATA_BACKEND=memory`, `LLM_TEXT_PROVIDER=mock`, `LLM_VISION_PROVIDER=mock`.
- Keep controllers thin; logic in services (testable, microservice-ready).
- Stock overrides + deterministic mock orders make live demos repeatable.
- Do NOT mention dataset source (BigBasket) anywhere in code, comments, or UI — keep catalog references generic ("grocery catalog").
- Bedrock/ALB/ElastiCache appear only in the production diagram, never in the running prototype (free tier).
