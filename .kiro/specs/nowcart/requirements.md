# Requirements Document

## Introduction

NowCart is an intent-capture layer on top of quick-commerce, built for the HackOn with Amazon
theme *"Reimagine Shopping Experience — Delivery is fast. Shopping isn't."* Instead of relying on a
search box, NowCart lets users express a **life moment** (a meal, a budget, a photo of a dish, a
shared recipe) and an agentic AI assembles a confident, ready-to-checkout cart.

The system is built with a TypeScript frontend, a FastAPI backend (MVC), a LangGraph multi-agent
engine, free-tier LLMs (Groq for text, Gemini for vision), DynamoDB, and Redis — all deployable on
the AWS free tier. The catalog is seeded from a real grocery dataset (BigBasket, ~500 products);
user/order/stock data is deterministic mock data for repeatable demos.

The product exposes one engine through several "front doors" and a shared trust/resilience layer.

## Glossary

- **Front door** — an input modality that captures user intent (voice, text, budget, photo, shared link).
- **Outcome** — a life moment expressed by the user (a meal, a task, a budget, an emergency).
- **Need** — a structured item requirement decomposed from an outcome (name, quantity, unit, category).
- **Outcome Engine** — the LangGraph multi-agent pipeline that turns an outcome into a cart.
- **Confidence score** — a 0–1 value expressing how sure the engine is about a product choice.
- **HITL** — human-in-the-loop; a clarifying question raised when confidence is below threshold.
- **Substitution** — replacing an out-of-stock product with a functional equivalent.
- **Stock override** — a demo control to force a product in/out of stock.

## Requirements

---

## Requirement 1: Outcome Engine (A1)

**User Story:** As a time-starved shopper, I want to state what I am making or doing in plain
language, so that the system assembles all the items I need without me searching for each one.

#### Acceptance Criteria
1. WHEN a user submits an outcome (e.g. "I'm making Biryani for 4") THEN the system SHALL return a structured list of needed items with name, quantity, unit, and category.
2. WHEN the outcome is decomposed into needs THEN the system SHALL map each need to a catalog product using fuzzy and category-based matching.
3. WHEN a need cannot be confidently matched to a product THEN the system SHALL flag it for substitution or clarification rather than silently dropping it.
4. WHEN the cart is assembled THEN the system SHALL return the cart with per-item price and a total within 1 response.
5. IF a serving count is provided THEN the system SHALL scale ingredient quantities proportionally.
6. WHEN the engine runs THEN it SHALL execute as a LangGraph multi-agent pipeline (intent → decompose → match → optimize → substitute → confidence).

## Requirement 2: Voice-to-Order (A2)

**User Story:** As a hands-busy user, I want to speak my request and confirm by voice, so that I can
order without typing.

#### Acceptance Criteria
1. WHEN a user activates the voice control THEN the system SHALL capture speech and convert it to text.
2. WHEN a voice transcript is received THEN the system SHALL route it through the same intent pipeline as text input.
3. WHEN a follow-up command is spoken (e.g. "add 2 more onions", "remove the ghee") THEN the system SHALL update the existing cart accordingly.
4. WHEN a compound command is spoken (e.g. "add milk, remove ghee, what's my total") THEN the system SHALL parse multiple intents and execute them in order.
5. WHILE processing voice THEN the UI SHALL reflect listening / processing / confirming states.

## Requirement 3: Constraint-First Ordering (A3)

**User Story:** As a budget-conscious user, I want to give a budget and number of people, so that the
system builds a complete cart that fits my constraint.

#### Acceptance Criteria
1. WHEN a user provides a budget and a serving count (e.g. "₹500, dinner for 4") THEN the system SHALL propose a complete cart whose total is within the budget.
2. IF no cart can satisfy the constraint THEN the system SHALL return the closest option and clearly state the shortfall.
3. WHEN building under a constraint THEN the system SHALL prefer items that maximize coverage of the outcome within budget.
4. WHEN a constraint cart is returned THEN the system SHALL show the remaining budget.

## Requirement 4: Show It / Share It (B2 + B4)

**User Story:** As a user inspired by a dish or a recipe online, I want to show a photo or share a
recipe, so that the ingredients are added to my cart automatically.

#### Acceptance Criteria
1. WHEN a user uploads a dish photo THEN the system SHALL identify the dish and extract its likely ingredients via a vision model.
2. WHEN a user submits a recipe link or pasted recipe text THEN the system SHALL extract ingredients from the content.
3. WHEN ingredients are extracted from an image or text THEN the system SHALL map them to catalog products through the Outcome Engine.
4. WHEN an uploaded image is processed THEN the system SHALL NOT permanently store the raw image (privacy-first; in-memory or short-TTL only).
5. IF the vision provider is unavailable THEN the system SHALL degrade gracefully with a clear message.

## Requirement 5: Comparison Collapse & Confidence Score (C2 + C3)

**User Story:** As an undecided user, I want the AI to pick one option and explain why, so that I do
not have to compare many similar products.

#### Acceptance Criteria
1. WHEN multiple candidate products match a need THEN the system SHALL select one recommended product with a single-line reason.
2. WHEN a product is recommended THEN the system SHALL attach a confidence score between 0 and 1.
3. IF the confidence score is below the configured threshold THEN the system SHALL ask the user one clarifying question instead of auto-selecting (human-in-the-loop).
4. WHEN a recommendation is shown THEN the system SHALL surface the single differentiating attribute that mattered (e.g. price-per-unit, rating, past preference).
5. WHEN requested THEN the system SHALL expose a reasoning trail describing the agent's decision path.

## Requirement 6: Substitution Intelligence (D2)

**User Story:** As a shopper, I want out-of-stock items swapped intelligently, so that my order is not
broken by unavailability.

#### Acceptance Criteria
1. WHEN a matched product is out of stock THEN the system SHALL substitute a functionally equivalent in-stock product.
2. WHEN a substitution is made THEN the system SHALL inform the user of the original, the substitute, and the reason.
3. WHEN substituting THEN the system SHALL prefer items of similar price, category, and rating.
4. WHEN no acceptable substitute exists THEN the system SHALL flag the item rather than substitute poorly.

## Requirement 7: SOS / Emergency Mode (D4)

**User Story:** As a user in an urgent situation, I want a one-tap emergency mode, so that I get the
exact kit I need as fast as possible.

#### Acceptance Criteria
1. WHEN a user activates SOS with a situation (e.g. "guests in 30 minutes", "child has fever") THEN the system SHALL assemble a targeted kit of items.
2. WHEN SOS is active THEN the system SHALL prioritize fastest-delivery, in-stock items.
3. WHEN an SOS cart is built THEN the system SHALL compress checkout to the minimum number of steps.
4. WHEN SOS is active THEN the UI SHALL display an urgency indicator (e.g. ETA countdown).

## Requirement 8: Catalog & Data (cross-cutting)

**User Story:** As the platform, I need a credible product catalog and repeatable demo data, so that
features behave realistically and demos are deterministic.

#### Acceptance Criteria
1. WHEN the system is seeded THEN it SHALL load a real grocery catalog (BigBasket dataset) with product, category, brand, price, and rating.
2. WHEN user/order data is needed THEN it SHALL use deterministic mock data seeded with a fixed seed.
3. WHEN stock availability is queried THEN it SHALL be controllable via an override so out-of-stock can be triggered on demand for demos.
4. WHEN the data backend is unavailable THEN the system SHALL fall back to an in-memory store so the app still runs.

## Requirement 9: Architecture, Scaling & Cost (cross-cutting / non-functional)

**User Story:** As an evaluator, I want the system to be cleanly architected, scalable, and free-tier
compliant, so that it scores on technical quality and scalability.

#### Acceptance Criteria
1. WHEN the backend is structured THEN it SHALL follow MVC with separated controllers, middleware, services, and repositories.
2. WHEN any LLM is called THEN it SHALL go through a swappable `LLMProvider` interface (Groq/Gemini now, Bedrock-ready later).
3. WHEN the system runs THEN it SHALL be stateless at the app layer, with cart/session state in Redis and durable data in DynamoDB.
4. WHEN deployed THEN it SHALL use only AWS free-tier services (EC2, S3, Lambda, DynamoDB, SQS) with Nginx for load balancing (no paid ALB/ElastiCache/Bedrock).
5. WHEN PII is present THEN it SHALL be redacted before any external LLM call (privacy-first).
6. WHEN frontend and backend exchange data THEN types SHALL be derived from a single OpenAPI contract.
