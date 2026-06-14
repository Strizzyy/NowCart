# NowCart — HackOn with Amazon Solution Document (PPT Content)

> This document provides the exact text content for each section of the hackathon PPT template,
> along with instructions for what images/diagrams to place where.

---

## Cover Page

| Field | Value |
|-------|-------|
| **Team Name** | [Your Team Name] |
| **Hackathon Theme** | Frictionless Shopping / Shopping by Intent / Predictive & Confident |
| **Date** | June 2025 |

### Team Members Table

| Name | College / University | Role | Email |
|------|---------------------|------|-------|
| [Member 1] | [College] | Backend + AI Engineer | [Email] |
| [Member 2] | [College] | Frontend Engineer | [Email] |
| [Member 3] | [College] | Infra + DevOps | [Email] |
| [Member 4] | [College] | Product + Design | [Email] |

---

## 1. Problem Statement & Relevance

### The Problem

Online grocery shoppers spend 10–15 minutes assembling carts for outcomes they already know — "Biryani for 4", "weekly restock for a family", "guests arriving in 30 minutes." They search each item individually, compare 6 variants of ghee without data, manually handle out-of-stock, and lose confidence in every choice. This "deciding tax" exists across all 300M+ global online grocery users and costs platforms an estimated 40% cart abandonment rate. Quick commerce solved the last-mile delivery problem in 10 minutes. Nobody has solved the 10-minute deciding problem before it.

### Why It Matters

- **300M+** online grocery shoppers globally face this friction daily
- **40% cart abandonment** — most users give up mid-assembly, not mid-checkout
- **$50B+** quick-commerce market (India alone: Blinkit, Zepto, Instamart) — all optimize delivery, none optimize deciding
- **Cost of inaction:** Every abandoned cart is lost GMV; every manual substitution is a trust failure; every 10-minute session is a user who might not return
- **Accessibility gap:** Elderly, visually impaired, and non-English speakers are locked out of text-search-only interfaces

### Theme Alignment

NowCart directly addresses **all three opportunity areas** from the hackathon brief — the only entry to do so with one coherent product:

1. **Frictionless Shopping** → Substitution Intelligence handles out-of-stock invisibly; one confident cart eliminates comparison paralysis
2. **Shopping by Intent** → The Outcome Engine + 4 front doors (voice, budget, photo, share) are literally intent-capture interfaces
3. **Predictive & Confident** → Comparison Collapse shows one pick with a confidence score and reasoning — the AI is confident enough to defend every choice

### What Makes This Novel

Every competitor in quick-commerce optimizes the **search box** — better autocomplete, better ranking, better filters. NowCart **removes the search box entirely**. The insight: users don't want products, they want outcomes. No existing solution:
- Works backwards from a budget constraint to suggest what to cook
- Accepts a photo of a dish and builds a cart to recreate it at home
- Parses a shared recipe reel into purchasable ingredients
- Provides per-item confidence scores with one-line reasoning
- Handles out-of-stock substitution as a first-class invisible intelligence (not a popup asking "is this OK?")

The system's architecture — 4 input modalities routing into one LangGraph multi-agent DAG — is genuinely novel. This positions NowCart as the missing **intelligence layer between a human need and any fulfillment network**.

---

## 2. Customer & Solution

### Target Customer

**Primary persona — "The Time-Starved Outcome Shopper":**
Urban, 22–40, opens a quick-commerce app already knowing the outcome (a meal, a fix, a party) but not wanting to spend 10 minutes assembling the product list manually. They cook 3–5 times a week, value "done in seconds" over browsing, and abandon carts when they hit choice paralysis or stock issues.

**Secondary personas:** Joint families delegating shopping (voice-first elders), accessibility users (hands-free), hostel students on tight budgets (constraint-first), food content creators (share-first from their own reels).

### How We Solve It

NowCart is an intent-capture layer with four "front doors" into one intelligent Outcome Engine:

• **Speak It** — "I'm making Biryani for 4" → voice captured → 12 items assembled in 6 seconds, with conversational follow-ups ("add 2 more onions")

• **Constrain It** — "₹500, dinner for 4 tonight" → engine works backwards from the constraint, picks a dish/combo that fits budget + servings, builds the cart

• **Show It** — Photo of a dish → multimodal AI identifies it → ingredient list → catalog-matched cart ("Recreate this at home")

• **Share It** — Paste a recipe reel/blog link → AI extracts ingredients from page content → cart

• **SOS Mode** — Emergency button → "guests in 30 min" → AI assembles exact kit from in-stock items only, 2-tap checkout

Every path outputs **one confident cart** with per-item confidence scores, comparison-collapse reasoning ("We compared all 6 ghees — picked A2: organic, best price-per-litre, 87% confidence"), and invisible substitution for out-of-stock items.

### User Workflow

```
[IMAGE: Insert the "4 doors → 1 brain → 1 cart" flow diagram here]

Diagram should show:
1. Four input cards (Speak, Constrain, Show, Share) at the top
2. Arrow converging into "Outcome Engine" (brain icon) in the middle
3. Arrow from engine to "One Confident Cart" at the bottom
4. Labels on the arrows: "intent normalization", "decompose + match + optimize"
```

**3-Step Flow:**
1. **Express** — User opens any front door (speak a meal, set a budget, snap a photo, paste a link)
2. **Engine** — LangGraph pipeline decomposes intent → matches 9,500+ products → optimizes picks → substitutes OOS → scores confidence
3. **Confirm** — One cart appears with confidence %, reasoning trail, and transparent substitutions. User reviews, tweaks if needed, checks out.

### Working Prototype

```
[IMAGE 1: Screenshot of the HomePage showing the 4 front door cards and the "Quick commerce solved delivery. We solve the deciding." hero]

[IMAGE 2: Screenshot of the CartDrawer showing a confident cart with:
- Per-item confidence chips (87%, 92%, etc.)
- A substitution banner ("We swapped 1 out-of-stock item")
- WhyThisOne reasoning expanded on one item
- The engine reasoning trail at the bottom]

[IMAGE 3: Screenshot of the SOS page showing emergency recommendations with product images, reasons, and "Add All to Cart" button]
```

**Demo:** [Live App URL] | [Demo Video URL]

---

## 3. Tech Architecture & Scaling

### Architecture

```
[IMAGE: Insert the full system architecture diagram from SYSTEM_ARCHITECTURE.md]

The diagram should show:
- Client layer (React 19 + Vite) at the top
- Middleware stack (RequestID → Telemetry → RateLimit → PII → CORS)
- Controllers (11 routers)
- Service layer (7 services)
- LangGraph Outcome Engine (6-node DAG with labeled nodes)
- LLM Providers (Groq, Gemini, Bedrock, Mock) on the left
- Data layer (DynamoDB + Repository protocol) in the center
- Cache layer (Redis + memory fallback) on the right
- AWS infrastructure at the bottom (CloudFront, S3, EC2, DynamoDB, SQS, Lambda)
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite 8 + TailwindCSS 4 | Fastest HMR, type-safe OpenAPI-generated types, zero CSS runtime cost |
| Backend | FastAPI + Pydantic 2 (fully async) | Native async I/O, auto OpenAPI schema generation, 10x faster than Flask |
| AI Pipeline | LangGraph (StateGraph DAG) | Composable multi-step reasoning with typed shared state — not a single monolithic prompt |
| Text LLM | Groq (Llama 3.3 70B, 200+ tok/s) | Fastest free inference; production swap to Bedrock is one env var |
| Vision LLM | Google Gemini 2.0 Flash (free tier) | Best multimodal quality for food identification at zero cost |
| Prod LLM Target | Amazon Bedrock (Claude 3 Haiku) | VPC-native, IAM auth, no API key rotation, AWS-managed scaling |
| Database | DynamoDB (PAY_PER_REQUEST) | Always-free 25GB, auto-scales R/W, GSI for category queries |
| Cache/State | Redis 7 | Sub-ms cart operations, session state, LLM response cache (1hr TTL) |
| Matching | rapidfuzz (C-compiled Levenshtein) | 100x faster than Python difflib; WRatio picks best scoring strategy per pair |
| Infra | EC2 + Nginx + S3 + CloudFront | Full stack on AWS free tier, CDN for global reach |
| Async Offload | Lambda + SQS (designed) | Auto-scales to 1000 concurrent LLM executions, dead-letter retries |

### Key Algorithms & Complexity

**Algorithm 1: LangGraph Multi-Agent DAG (Outcome Engine)**
- 6-node directed acyclic graph: `intent → decompose → match → optimize → substitute → confidence`
- Shared TypedDict state enables cross-node data access (substitute reads match candidates)
- Time complexity per request: O(N × M) where N = decomposed needs, M = catalog size
- Not a simple linear chain — compositional, extensible, debuggable

**Algorithm 2: Hybrid Fuzzy Matching with Word-Presence Re-ranking**
- Phase 1: Category alias bridging (30+ aliases → BigBasket taxonomy) narrows 9,534 → ~200-800 candidates
- Phase 2: rapidfuzz `WRatio` scorer (internally picks best from 4 scoring strategies per pair)
- Phase 3: Custom stem-based re-ranking with +20/+35 bonuses and -15 penalties for false positives
- Complexity: O(K log K) per need where K = category-filtered candidates

**Algorithm 3: Constraint-First Budget Optimization**
- Greedy confidence-sorted knapsack: sort items by confidence descending → greedily keep until budget exhausted
- Ensures highest-confidence items survive the budget cut — preserving trust
- Complexity: O(N log N) sort + O(N) greedy pass

**Algorithm 4: Quantity Normalization Heuristic**
- Converts raw LLM quantities (500g, 200ml, 2 tablespoons) to "number of packs to buy"
- Unit-category mapping: weight, volume, spoon measures, pack units, ambiguous descriptors
- Bridges the fundamental gap between "recipe language" and "store language"

**Algorithm 5: LLM Response Caching**
- SHA-256(system_prompt || user_input) → deterministic cache key
- Redis-backed with 1-hour TTL
- 100 identical queries → 1 LLM call + 99 cache hits (<1ms each)
- Complexity: O(1) lookup, O(n) hash computation (one-time)

### Scaling Strategy

**Current (prototype):** Single EC2 t2.micro running Uvicorn + Redis + Nginx; DynamoDB on-demand.

**100x Scale (all free-tier architecture):**

| Layer | Current | 100x Strategy |
|-------|---------|---------------|
| Compute | 1 × EC2 t2.micro | Auto Scaling Group behind ALB (stateless = horizontal) |
| State | Redis on same box | ElastiCache Redis cluster with read replicas |
| DB | DynamoDB on-demand | Auto-scales reads/writes natively — no sharding needed |
| LLM calls | Synchronous in API | SQS → Lambda async (already designed: 1000 concurrent) |
| Frontend | S3 + CloudFront | Already globally distributed CDN — handles millions |
| Caching | Redis LLM cache | Add DynamoDB DAX for catalog, edge caching for static |

**Key decisions enabling scale:**
- **Stateless API** — Cart state lives in Redis, not in-process. Any instance can serve any request.
- **DynamoDB on-demand** — Auto-scales without capacity planning. 25 GB free, then pay-per-request.
- **Async offloading** — Vision analysis (~3s) and recipe parsing (~2s) offloaded to Lambda via SQS.
- **Provider abstraction** — Groq → Bedrock swap is one env var; lower latency in-VPC at scale.
- **LLM response caching** — At 10K users, most common recipes are cache hits (zero API cost).

**1000x / Global:**
- Multi-region DynamoDB Global Tables (automatic replication)
- Regional EC2 behind Route 53 latency-based routing
- CloudFront edge functions for API routing
- SQS FIFO for order-critical paths

---

## 4. Future Vision

### Where This Goes

NowCart becomes the universal **"need → done" layer** on top of any fulfillment network. Today it's grocery; tomorrow it's any domain where humans know *what they want to accomplish* but not *what specific products to buy*. The intent-capture + multi-agent pipeline is domain-agnostic — only the catalog and decomposition prompts change.

### Roadmap

| Horizon | Milestone | Impact |
|---------|-----------|--------|
| 0–3 mo | Food/grocery outcome ordering in one Indian city. Voice + budget + photo live. | 10K active users, prove the thesis, 3x faster cart assembly vs. manual |
| 3–6 mo | Pharmacy + emergency health kits (SOS expands to health). Multi-language voice (Hindi, Tamil, Bengali). Bedrock production deployment. | 100K users, SOS saves lives, language barrier removed |
| 6–12 mo | B2B restocking (restaurant/office bulk orders), travel/event kits, integration with Amazon Fresh/Blinkit APIs. The intent-capture layer becomes horizontal. | 1M+ users, platform play, licensing model |

### Multi-Segment Expansion

```
[IMAGE: A horizontal expansion diagram showing:]

GROCERY (today)
    ↓
PHARMACY (3-6 mo)         → "child has fever" → OTC + hydration kit
    ↓
B2B RESTOCKING (6-12 mo)  → "restock my restaurant for the week" → bulk cart
    ↓
TRAVEL/EVENT KITS          → "camping trip for 6" → gear + food kit
    ↓
HORIZONTAL PLATFORM        → Any catalog + intent-capture layer = "need → done"
```

The path: **grocery → pharmacy → B2B → travel → horizontal platform**. Each expansion reuses the same Outcome Engine, same LangGraph pipeline, same confidence/substitution layer. Only the catalog data and decomposition prompts change.

### Value Impact

- **Users impacted at scale:** 300M+ online grocery shoppers globally; 50M in India alone
- **Time saved:** 10 minutes/session × 3 sessions/week = 30 min/user/week = 26 hours/year/user
- **Cart abandonment reduction:** From ~40% to <15% (confident carts with pre-resolved OOS)
- **Platform GMV lift:** Faster carts → more completed orders → higher order frequency
- **Accessibility:** Voice-first and photo-first inputs serve 100M+ users excluded by text-only interfaces
- **Revenue model at scale:** SaaS licensing to quick-commerce platforms ($0.02–$0.05 per cart built); white-label intent layer

---

## Links

| Resource | URL |
|----------|-----|
| GitHub | [Your GitHub repo URL] |
| Demo Video | [Your demo video URL] |
| Live App | [Your deployed app URL] |

---

## Appendix: Image Placement Guide

### Slide 1 (Cover)
- Keep the Amazon hackathon header image
- Add NowCart logo if you have one (otherwise the "N" brand mark from the app)

### Slide 2 (Problem Statement)
- **No image needed** — the text is the star here
- Optional: A simple stat graphic showing "300M users × 10 min = billions of wasted hours"

### Slide 3 (Customer & Solution)
- **IMAGE A (top-right):** Screenshot of the HomePage with 4 front door cards visible
  - Crop to show: hero text + the 4 door cards + the "Four doors → One brain → One confident cart" chip flow
- **IMAGE B (User Workflow section):** A clean flow diagram:
  ```
  [Speak] [Constrain] [Show] [Share]
            ↓
      [Outcome Engine]
            ↓
    [One Confident Cart]
  ```
  Make this in Figma/Canva — clean boxes with icons, arrows converging
- **IMAGE C (Working Prototype section):** 2-3 screenshots:
  1. The CartDrawer showing confidence scores + substitution banner + reasoning
  2. The SOS page with emergency recommendations and product images
  3. (Optional) The ConstrainPanel showing "₹500, 4 people" → cart result

### Slide 4 (Tech Architecture)
- **IMAGE A (Architecture section):** The full system architecture diagram
  - Recreate the ASCII diagram from SYSTEM_ARCHITECTURE.md as a clean visual in Figma/draw.io
  - Key elements to include: Client layer → Middleware → Controllers → Services → LangGraph DAG → LLM Providers + Data Layer + Cache
  - Use AWS service icons for DynamoDB, Lambda, SQS, S3, CloudFront, EC2
- **No other images needed** — the tech stack table and algorithm descriptions are text-heavy by design

### Slide 5 (Future Vision)
- **IMAGE A (Multi-Segment section):** A horizontal timeline or expansion funnel:
  - Show: Grocery → Pharmacy → B2B → Travel → Platform
  - Use icons for each segment
  - Arrow showing growing TAM at each stage
- **Optional:** A "1M users by 12 months" growth chart mockup

---

## Appendix: Demo Talking Points (for live presentation)

### Opening (30 sec)
"Quick commerce made delivery instant. But you still spend 10 minutes deciding what to buy. We fixed deciding. NowCart is an intent-capture layer — four ways to express what you need, one AI brain that assembles a confident cart in seconds."

### Demo Beat 1 — Speak (45 sec)
*Open the Speak panel*
"I'm making Biryani for 4."
*Cart builds: 12 items, confidence scores visible*
"Six seconds. Twelve items. Each one scored — the engine compared all options and picked one per need."

### Demo Beat 2 — Show (45 sec)
*Open the Show panel, upload a photo of a dish*
"I took this photo at a restaurant. Watch."
*Cart appears with identified dish and all ingredients*
"Gemini Vision identified the dish, extracted ingredients, and the Outcome Engine matched them to our 9,500-product catalog."

### Demo Beat 3 — Constrain (30 sec)
*Open the Constrain panel: ₹500, 4 people*
"Five hundred rupees. Four people. Tonight."
*Cart appears within budget*
"The engine worked backwards from the constraint. It picked a meal that fits, built the full cart, and told me I have ₹47 remaining."

### Trust Moment (30 sec)
*Expand a cart item's "Why this one?" reasoning*
"Every item has a confidence score. Expand any item and you see the comparison reasoning. And see this banner? One item was out of stock — the engine swapped it automatically. Amul butter out, Britannia in, same price, 4.5 stars."

### SOS Peak (30 sec)
*Navigate to /sos, type "guests arriving in 30 minutes"*
"This is SOS mode. Genuine urgency. The AI analyzed the situation, recommended exactly what's needed, and every item is filtered to in-stock only."

### Architecture Close (20 sec)
*Open /api/meta/stats in a new tab*
"And here's our real-time observability. Latency percentiles, cache hit ratios, error rates. This is how we'd make scaling decisions in production. The architecture is stateless, provider-agnostic, and every heavy LLM call can offload to Lambda."

### Final Line
"Four doors. One brain. One confident cart. Blinkit doesn't have this. Zepto doesn't have this. Instamart doesn't have this. We built the missing layer."
