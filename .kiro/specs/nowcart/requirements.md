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
- **Front Door Hub** — the landing/home experience that presents the four front doors and the "four ways in, one brain, one confident cart out" narrative.
- **Front-door panel** — a dedicated UI surface for one front door (Speak it, Constrain it, Show it, Share it) with its own input, loading, empty, and error states.
- **Confidence chip** — an always-visible UI badge that shows a recommended product's confidence score and a one-line "why this one" reason.
- **Reasoning trail** — the ordered list of decision steps the Outcome Engine took, surfaced in the UI on demand (comparison-collapse expansion).
- **Design system** — the shared set of theme tokens, typography, spacing, color, and component styles that give the revamped frontend a cohesive look.
- **Contract drift** — a mismatch between the types the frontend expects and the types the backend exposes via the OpenAPI contract.

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

## Requirement 10: Frontend Revamp & Backend Sync (experience layer)

**User Story:** As a hackathon judge and a first-time user, I want a beautiful, modern frontend that
visibly tells the NowCart story and lets me enter through any of the four front doors, so that the
product's thesis — *"Quick commerce solved delivery. We solve the deciding."* — is obvious within
seconds, and the backend exposes exactly the data the experience needs.

This requirement revamps the entire frontend so it fully embodies the NowCart ideation
("four ways in, one brain, one confident cart out") and synchronizes the backend so frontend and
backend contracts stay aligned. Acceptance criteria are grouped by experience area
(Front Door Hub, the four front doors, confident cart, substitution, SOS, backend sync, and visual
quality) but constitute one cohesive revamp requirement.

#### Acceptance Criteria

**Front Door Hub & story-driven landing**
1. WHEN the application loads the Front Door Hub THEN the system SHALL present the thesis statement "Quick commerce solved delivery. We solve the deciding." and the narrative "Four ways in, one brain, one confident cart out." as primary on-screen content.
2. WHEN the Front Door Hub is displayed THEN the system SHALL render the four front doors (Speak it, Constrain it, Show it, Share it) as four first-class, visually distinct entry points.
3. WHEN a user selects a front door THEN the system SHALL open the corresponding front-door panel without a full page reload.
4. WHILE no front door has been activated THEN the system SHALL display an empty state that explains the "four doors to one brain to one cart" flow.
5. WHERE the viewport width is below the mobile breakpoint THEN the system SHALL present the four front doors in a single-column responsive layout.

**"Speak it" voice front door**
6. WHEN a user activates the voice front door THEN the system SHALL display a listening state with a visible recording indicator.
7. WHILE speech is being captured THEN the system SHALL display incremental live transcription text.
8. WHEN the transcript is submitted to the intent pipeline THEN the system SHALL display a processing state until a cart or clarification is returned.
9. WHEN the Outcome Engine returns a result THEN the system SHALL display a confirming state showing the interpreted request alongside the resulting cart.
10. WHEN the Outcome Engine raises a conversational follow-up THEN the system SHALL display the follow-up question and accept a spoken or typed reply.
11. IF microphone access is denied or unavailable THEN the system SHALL display a fallback message and a typed-input alternative.

**"Constrain it" budget/text front door**
12. WHEN a user submits a budget and a serving count THEN the system SHALL display a cart whose total and remaining budget are both shown explicitly.
13. WHILE the constraint cart is being assembled THEN the system SHALL display a loading state.
14. IF no cart can satisfy the constraint THEN the system SHALL display the closest cart and a clearly labeled shortfall amount.
15. IF a user submits an empty or non-numeric budget THEN the system SHALL display an inline validation message and SHALL NOT call the Outcome Engine.

**"Show it" photo front door**
16. WHEN a user uploads or captures a dish photo THEN the system SHALL display a preview of the selected image before processing.
17. WHILE the image is being analyzed THEN the system SHALL display a processing state.
18. WHEN the vision result returns ingredients THEN the system SHALL display the identified dish and the resulting cart.
19. IF the vision provider is unavailable or returns a degraded result THEN the system SHALL display a friendly message and SHALL offer a typed-input alternative.
20. WHEN an image is processed THEN the system SHALL discard the raw image at the end of the active session.

**"Share it" recipe link/text front door**
21. WHEN a user submits a recipe link or recipe text THEN the system SHALL send the content to the share endpoint and display a loading state.
22. WHEN ingredients are extracted from the shared content THEN the system SHALL display the resulting cart.
23. IF the shared content cannot be parsed into ingredients THEN the system SHALL display a descriptive error and SHALL offer a typed-input alternative.
24. WHEN a share result is displayed THEN the system SHALL indicate the source (link or pasted text) that produced the cart.

**One confident cart, confidence & comparison collapse**
25. WHEN any front door returns a cart THEN the system SHALL display exactly one recommended cart as the primary result.
26. WHEN a recommended product is displayed THEN the system SHALL show a confidence chip containing the confidence score and a one-line "why this one" reason.
27. WHEN a user expands a recommendation THEN the system SHALL display the reasoning trail describing the engine's decision path.
28. IF the confidence score for a pick is below the configured threshold THEN the system SHALL display the clarifying question as a human-in-the-loop prompt instead of presenting the pick as final.
29. WHEN the cart is displayed THEN the system SHALL show, per item, the price, the confidence, and any substitution note, together with the cart total.

**Substitution notices**
30. WHEN a cart contains a substituted item THEN the system SHALL display a notice showing the original product, the substitute product, and the reason.
31. WHEN a substitution notice is displayed THEN the system SHALL visually distinguish substituted items from directly matched items.
32. WHEN an item is flagged as unmatched THEN the system SHALL display the flagged item in the cart with its unmatched status.

**SOS / emergency mode UI**
33. WHEN the application is displayed THEN the system SHALL present a prominent one-tap SOS entry point.
34. WHEN SOS mode is activated THEN the system SHALL display an emergency UI with an urgency indicator and an ETA countdown.
35. WHEN an SOS cart is displayed THEN the system SHALL prioritize and label fastest-delivery, in-stock items.
36. WHEN a user proceeds from an SOS cart THEN the system SHALL present a compressed checkout of at most two steps.

**Backend sync & contract alignment**
37. WHERE the revamped frontend requires data or an endpoint the backend does not yet expose THEN the system SHALL extend the backend so the required data is available through a defined endpoint.
38. WHEN frontend types are generated THEN the system SHALL derive them from the single OpenAPI contract so that frontend and backend share one source of truth.
39. WHEN the voice front door requires intermediate states THEN the backend SHALL expose streaming or staged responses sufficient to drive the listening, processing, and confirming UI states.
40. WHEN the comparison-collapse UI requests reasoning THEN the backend SHALL expose the reasoning trail for the recommendation.
41. WHEN SOS mode requires timing data THEN the backend SHALL expose ETA and countdown data for the assembled SOS cart.
42. WHEN constraint mode displays remaining budget THEN the backend SHALL include the remaining-budget value in the constraint response.
43. WHEN the frontend consumes backend data THEN the system SHALL use the existing endpoints (outcome, voice/intent, constraint, vision/photo, share, cart/op, cart/{session}, sos, catalog/search, admin/stock) for their corresponding front doors and operations.
44. IF a backend endpoint returns an error or degraded result THEN the corresponding front-door panel SHALL display an error or degraded state with a descriptive message.

**Visual quality, responsiveness & accessibility**
45. WHEN any screen renders THEN the system SHALL apply a single cohesive design system (theme, typography, color, spacing) across all front doors and the cart.
46. WHEN a state transition occurs THEN the system SHALL render a transition animation and SHALL provide loading, empty, and error states for the active front door.
47. WHEN the viewport changes across mobile, tablet, and desktop breakpoints THEN the system SHALL present a responsive layout without horizontal overflow.
48. WHEN a user navigates with a keyboard THEN the system SHALL expose focusable, operable controls for every interactive element.
49. WHEN text is rendered THEN the system SHALL meet a contrast ratio of at least 4.5:1 for normal text.
50. WHERE a user relies on the voice front door THEN the system SHALL support a hands-free path from activation through cart confirmation.
