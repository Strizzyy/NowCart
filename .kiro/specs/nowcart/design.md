# Design — NowCart

## Overview

NowCart is a single intelligent engine exposed through multiple input "front doors" (voice, text,
budget, photo, shared link) that all normalize into a structured intent, flow through a LangGraph
multi-agent pipeline, and return one confident cart. The design optimizes for: clean MVC separation,
type safety end-to-end, async I/O, free-tier AWS deployability, and a deterministic, demo-proof data
layer.

This design satisfies Requirements 1–9.

## Architecture

```
                       INPUT LAYER (front doors)
        Voice (A2) | Text/Budget (A1/A3) | Photo (B2) | Share link (B4)
                                  │
                                  ▼
                     INTENT NORMALIZATION (controllers + middleware)
                          PII redaction · rate limit · request id
                                  │
                                  ▼
                     LANGGRAPH OUTCOME ENGINE (agents)
        intent → decompose → match → optimize → substitute → confidence → HITL
                                  │
        ┌──────────────┬─────────┼──────────┬───────────────┐
        ▼              ▼         ▼          ▼               ▼
   catalog_service  substitution  confidence  budget_service  sos_service
        │              │         │          │               │
        ▼              ▼         ▼          ▼               ▼
   repositories (DynamoDB | in-memory)         Redis (cart, cache, stock override)
        │
        ▼
   LLMProvider (Groq text · Gemini vision · mock fallback)
```

### Layered responsibilities (Requirement 9.1)
- **controllers/** — HTTP routes only; validate DTOs, call services, return DTOs. No business logic.
- **middleware/** — cross-cutting: PII redaction, rate limiting, request id, CORS.
- **services/** — business logic; orchestrate agents, repositories, cache.
- **agents/** — LangGraph state, nodes, and graph wiring (the Outcome Engine).
- **repositories/** — data access; abstract DynamoDB vs in-memory behind one interface.
- **llm/** — `LLMProvider` interface + Groq/Gemini/mock implementations + factory.
- **models/** — Pydantic `domain/` (internal) and `dto/` (request/response contracts).

## Components and Interfaces

### LLMProvider (Requirement 9.2)
```python
class LLMProvider(Protocol):
    async def complete_json(self, system: str, user: str, schema_hint: str) -> dict: ...
    async def complete_text(self, system: str, user: str) -> str: ...

class VisionProvider(Protocol):
    async def describe_image(self, image_bytes: bytes, prompt: str) -> dict: ...
```
- `GroqProvider`, `GeminiProvider`, `MockProvider` implement these.
- `llm/factory.py` selects provider from settings; `mock` lets the app run with zero keys.

### Agents (Requirement 1.6)
`AgentState` (TypedDict) carries: `raw_input`, `mode`, `needs[]`, `candidates{}`, `cart`,
`substitutions[]`, `confidence`, `reasoning_trail[]`, `clarification`.

Nodes:
- `intent_node` — classify mode (recipe | budget | photo | link | sos | cart_op) + normalize.
- `decompose_node` — outcome → needs[] (LLM); budget branch calls `budget_service`.
- `match_node` — needs → candidate products (rapidfuzz + category + catalog_service).
- `optimize_node` — pick best candidate per need (and budget optimization for A3).
- `substitute_node` — replace out-of-stock with functional equivalents (D2).
- `confidence_node` — score picks; if below threshold set `clarification` (HITL, C3).

Conditional edge after `match_node`: in-stock → `optimize`, has out-of-stock → `substitute` → `optimize`.

### Services
- `outcome_service` — runs the graph, persists cart to Redis, returns cart DTO.
- `catalog_service` — product lookup, fuzzy match, category filter, availability (with stock override).
- `substitution_service` — candidate ranking for swaps.
- `confidence_service` — scoring function (rating, price-per-unit, past preference, match quality).
- `budget_service` — constraint-first selection (knapsack-style greedy within budget).
- `sos_service` — emergency kit templates + fastest-delivery filter.
- `cart_service` — add/remove/update/total operations (voice follow-ups).

### Controllers (REST)
```
POST /api/outcome           {text, servings?}            -> CartResponse
POST /api/voice/intent      {transcript}                 -> CartResponse | CartOp
POST /api/constraint        {budget, servings, text?}    -> CartResponse
POST /api/vision/photo      multipart image              -> CartResponse
POST /api/share             {url? , text?}               -> CartResponse
POST /api/cart/op           {op, entity, quantity?}      -> CartResponse
GET  /api/cart/{session_id}                              -> CartResponse
POST /api/sos               {situation}                  -> CartResponse
POST /api/admin/stock       {product_id, in_stock}       -> ok   (demo control)
GET  /api/catalog/search    ?q=&category=                -> Product[]
GET  /health                                             -> ok
```

## Data Models

_(Satisfies Requirement 8)_

### Product (catalog — from BigBasket dataset)
```
product_id: str          name: str            brand: str
category: str            sub_category: str    type: str
sale_price: float        market_price: float  rating: float | None
unit: str (parsed)       in_stock: bool       delivery_eta_min: int
tags: list[str]          image_url: str | None
```

### Cart / CartItem
```
Cart { session_id, items: CartItem[], total, currency="INR", mode, confidence, notes[] }
CartItem { product_id, name, brand, price, quantity, unit, reason, confidence, substituted_for? }
```

### Need (decomposed)
```
Need { name, quantity, unit, category_hint, matched_product_id?, status }
```

### Storage layout
- DynamoDB tables: `Products` (PK product_id, GSI category), `Users` (PK user_id),
  `Orders` (PK user_id, SK order_date).
- Redis keys: `cart:{session}`, `outcome:{hash}` (LLM cache), `stock:{product_id}` (override).
- `data_backend=memory` swaps DynamoDB for an in-process dict store (same repository interface).

## Error Handling
- LLM failures → retry (tenacity) then fall back to `MockProvider` / heuristic decomposition.
- Vision unavailable → return 200 with `degraded: true` and a message (Requirement 4.5).
- No catalog match → `Need.status = "unmatched"` surfaced in cart notes, not dropped (1.3).
- Budget infeasible → closest cart + `shortfall` field (3.2).
- All controllers wrap service errors into a consistent `ErrorResponse` DTO.

## Privacy & Security (Requirement 9.5)
- `pii_redaction` middleware strips names/addresses/phone/email patterns before LLM calls.
- Uploaded images processed in-memory; if S3 is used, objects get a short-TTL lifecycle rule.
- Network-exposed endpoints note: prototype is unauthenticated; production adds API Gateway auth.

## Scaling Strategy (Requirement 9.3, 9.4)
- App layer is stateless; horizontal scale behind Nginx on EC2.
- Redis holds cart/session + LLM response cache (common outcomes computed once).
- Heavy/slow work (image analysis, link parsing) can be offloaded to Lambda via SQS.
- DynamoDB auto-scales; single-digit-ms reads; no connection-pool limits.

## Type Safety (Requirement 9.6)
- Backend DTOs are Pydantic; FastAPI emits OpenAPI; frontend generates TS types via
  `openapi-typescript` so client and server never drift.

## Testing Strategy
- Unit: confidence scoring, budget greedy selection, fuzzy matching, substitution ranking.
- Agent: graph runs end-to-end with `MockProvider` (deterministic) for each mode.
- API: controller happy-path + degraded paths (vision down, budget infeasible, out-of-stock).
- Seed: verify catalog loads and key demo recipes resolve to in-stock products.

## Correctness Properties

### Property 1: No silent drops
Every decomposed need appears in the result either as a cart item, a substitution, or an explicitly
flagged unmatched note.
**Validates: Requirements 1.3**

### Property 2: Budget invariant
A constraint cart's total is ≤ budget, or the response explicitly states the shortfall.
**Validates: Requirements 3.1, 3.2**

### Property 3: Confidence gating
Any auto-selected item has confidence ≥ threshold; otherwise a clarification is raised instead of a
silent pick.
**Validates: Requirements 5.2, 5.3**

### Property 4: Substitution traceability
Every substituted item records its original product and the reason for the swap.
**Validates: Requirements 6.2**

### Property 5: Privacy invariant
No raw uploaded image is persisted beyond processing; PII is redacted before any external LLM call.
**Validates: Requirements 4.4, 9.5**

### Property 6: Deterministic demo
Identical seed plus identical input yields an identical cart on the mock provider path.
**Validates: Requirements 8.2**

### Property 7: Graceful degradation
Any provider or backend failure yields a valid response with a degraded flag, never an unhandled
error.
**Validates: Requirements 4.5, 8.4**

## Frontend (Nest grocery theme)
- React + Vite + TypeScript; Tailwind; feature-based folders mirroring backend.
- Theme: green accent (~#3BB77E), white cards, rounded corners, category sidebar (per Figma refs).
- Key screens: Home (catalog + front-door bar), Outcome/Voice composer, Cart drawer with
  confidence chips + substitution notices, SOS mode, Comparison-collapse card.
