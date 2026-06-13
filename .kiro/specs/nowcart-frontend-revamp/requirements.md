# Requirements Document

## Introduction

This feature is a complete revamp of the NowCart frontend and a backend sync to match the
revamped, more capable frontend. NowCart embodies the thesis **"Quick commerce solved delivery.
We solve the deciding."** It is an intent-capture layer that turns a life moment into one ready,
confident cart. The user can *say it, show it, share it, or set a budget*; an AI Outcome Engine
assembles a single confident cart and can defend every choice.

The revamped frontend MUST embody the product narrative **"Four ways in, one brain, one confident
cart out."** It removes the traditional search box and presents four front doors (Voice, Text/Budget,
Photo, Shared link) that all flow into one intelligent Outcome Engine and return one confident cart.
The frontend MUST be demo-worthy for the HackOn with Amazon hackathon: a clean "4 doors → 1 brain →
1 cart" visual, screenshot-worthy Show-It and SOS moments, visible confidence scores, and live
out-of-stock substitution.

This spec is scoped to the presentation layer (React + Vite + TypeScript) and the backend changes
required to fully support it (FastAPI MVC, LangGraph engine, OpenAPI contract). It reuses and aligns
with the existing `.kiro/specs/nowcart/` system spec (Requirements 1–9) rather than redefining the
engine internals; here the focus is the user-facing experience and the API contract that powers it.

The target persona is the time-starved urgent shopper (urban, 22–40) who knows the desired outcome
but not the product list, plus households/roommates (shared link, budget split) and accessibility /
hands-free voice users.

## Glossary

- **NowCart_Frontend** — the React + Vite + TypeScript client application being revamped.
- **NowCart_Backend** — the FastAPI (MVC) server that the frontend communicates with.
- **Front_Door** — one of four input modalities that capture user intent: Voice, Text/Budget, Photo, Shared_Link.
- **Intent_Composer** — the unified frontend surface that presents the four Front_Doors and routes input to the backend.
- **Outcome** — a life moment expressed by the user (a meal, a task, a budget, an emergency).
- **Outcome_Engine** — the LangGraph multi-agent backend pipeline (decompose → match → optimize → substitute → confidence) that turns an Outcome into a cart.
- **Engine_Progress_View** — the frontend component that visualizes Outcome_Engine pipeline stages while a request is processing.
- **Confident_Cart** — the single assembled cart returned by the Outcome_Engine, including items, total, confidence, and substitutions.
- **Cart_Drawer** — the frontend panel that displays the Confident_Cart.
- **Confidence_Score** — a value between 0 and 1 expressing how sure the Outcome_Engine is about a product choice or the overall cart.
- **Comparison_Collapse** — presenting one recommended product with a one-line reason instead of a list of alternatives.
- **Reasoning_Trail** — the ordered list of decision steps the Outcome_Engine recorded for a cart.
- **HITL_Prompt** — a human-in-the-loop clarifying question shown when the Confidence_Score is below the configured threshold.
- **Substitution** — replacing an out-of-stock product with a functional equivalent, recorded with original, substitute, and reason.
- **SOS_Mode** — the emergency fast-path that builds a targeted kit of fastest-delivery items with a compressed checkout.
- **ETA_Countdown** — a visible countdown indicator shown in SOS_Mode representing estimated delivery time.
- **Checkout_Flow** — the frontend flow that converts a Confident_Cart into a placed order.
- **Stock_Override_Control** — a demo control in the frontend that forces a product in or out of stock via the backend admin endpoint.
- **API_Contract** — the single OpenAPI specification emitted by NowCart_Backend from which frontend TypeScript types are generated.
- **Confidence_Threshold** — the configured Confidence_Score boundary below which a HITL_Prompt is raised.

## Requirements

---

### Requirement 1: Unified Intent Composer (Four Front Doors)

**User Story:** As a time-starved shopper, I want one clear surface offering four ways to express
what I need, so that I can capture my intent without using a search box.

#### Acceptance Criteria

1. WHEN the NowCart_Frontend loads the home view, THE Intent_Composer SHALL present exactly four Front_Doors: Voice, Text/Budget, Photo, and Shared_Link.
2. WHEN a user selects a Front_Door, THE Intent_Composer SHALL display the input controls for that Front_Door and hide the controls of the other Front_Doors.
3. WHEN a user submits input through any Front_Door, THE NowCart_Frontend SHALL route the input to the corresponding NowCart_Backend endpoint and receive one Confident_Cart in response.
4. WHILE any Front_Door request is in progress, THE NowCart_Frontend SHALL display the Engine_Progress_View and disable resubmission of the same input.
5. THE Intent_Composer SHALL display the narrative statement "Four ways in, one brain, one confident cart out" within the home view.
6. WHERE the NowCart_Frontend viewport width is below 768 pixels, THE Intent_Composer SHALL present the four Front_Doors in a single-column layout.

### Requirement 2: Voice Front Door

**User Story:** As a hands-free user, I want to speak my request and see live feedback, so that I can
build a cart without typing.

#### Acceptance Criteria

1. WHEN a user activates the Voice Front_Door, THE NowCart_Frontend SHALL capture speech and convert it to a text transcript.
2. WHEN a voice transcript is captured, THE NowCart_Frontend SHALL send the transcript to the NowCart_Backend voice endpoint and render the returned Confident_Cart.
3. WHILE the Voice Front_Door is active, THE NowCart_Frontend SHALL display the current voice state as one of listening, processing, or confirming.
4. WHEN a follow-up voice command modifies an existing cart (for example "add 2 onions" or "remove the ghee"), THE NowCart_Frontend SHALL send the command with the active session identifier and render the updated Confident_Cart.
5. IF the browser does not support speech capture, THEN THE NowCart_Frontend SHALL display a message offering the Text/Budget Front_Door as an alternative.
6. IF speech capture returns an error, THEN THE NowCart_Frontend SHALL display a retry control and the listening state SHALL return to idle.

### Requirement 3: Text and Budget Front Door (Constraint-First)

**User Story:** As a budget-conscious shopper, I want to type what I want and optionally set a budget
and serving count, so that the system builds a complete cart that fits my constraint.

#### Acceptance Criteria

1. WHEN a user submits free text describing an Outcome, THE NowCart_Frontend SHALL send the text and optional serving count to the NowCart_Backend outcome endpoint and render the returned Confident_Cart.
2. WHEN a user provides a budget and a serving count, THE NowCart_Frontend SHALL send the constraint to the NowCart_Backend constraint endpoint and render the returned Confident_Cart.
3. WHEN a Confident_Cart returned under a budget includes a remaining budget value, THE Cart_Drawer SHALL display the remaining budget.
4. IF a Confident_Cart returned under a budget includes a shortfall value, THEN THE Cart_Drawer SHALL display the shortfall amount and a statement that the budget could not be fully satisfied.
5. WHEN the Text and Budget Front_Door is displayed, THE NowCart_Frontend SHALL show at least one example prompt to guide input.

### Requirement 4: Photo "Show It" Front Door

**User Story:** As a user inspired by a dish, I want to show a photo, so that the ingredients are
identified and added to my cart automatically.

#### Acceptance Criteria

1. WHEN a user selects an image through the Photo Front_Door, THE NowCart_Frontend SHALL display a preview of the selected image before submission.
2. WHEN a user submits a selected image, THE NowCart_Frontend SHALL upload the image to the NowCart_Backend vision endpoint and render the returned Confident_Cart.
3. WHEN a Confident_Cart is returned from an image submission, THE NowCart_Frontend SHALL display the identified dish name alongside the cart.
4. IF the NowCart_Backend response indicates the vision provider is degraded, THEN THE NowCart_Frontend SHALL display a degraded-mode message and still render any returned cart.
5. WHEN an image submission completes, THE NowCart_Frontend SHALL discard the selected image from frontend state without persisting it to local storage.

### Requirement 5: Shared Link "Share It" Front Door

**User Story:** As a user who found a recipe online or received a shared list, I want to paste a link
or recipe text, so that its ingredients become a cart.

#### Acceptance Criteria

1. WHEN a user submits a recipe link or pasted recipe text through the Shared_Link Front_Door, THE NowCart_Frontend SHALL send the content to the NowCart_Backend share endpoint and render the returned Confident_Cart.
2. WHEN the NowCart_Frontend produces a Confident_Cart, THE NowCart_Frontend SHALL provide a control that generates a shareable link representing that cart.
3. WHEN a user opens the NowCart_Frontend with a shared cart link, THE NowCart_Frontend SHALL load and render the referenced Confident_Cart.
4. IF submitted shared content yields no extractable items, THEN THE NowCart_Frontend SHALL display a message that no items could be extracted and offer another Front_Door.

### Requirement 6: One Confident Cart Output

**User Story:** As a shopper, I want one assembled cart with a clear total, so that I can review and
check out without comparing options myself.

#### Acceptance Criteria

1. WHEN a Confident_Cart is returned from any Front_Door, THE Cart_Drawer SHALL open and display every cart item with its name, brand, quantity, unit, and line total.
2. WHEN the Cart_Drawer displays a Confident_Cart, THE Cart_Drawer SHALL display the cart total and currency.
3. WHEN the Cart_Drawer displays a Confident_Cart, THE Cart_Drawer SHALL display the overall Confidence_Score as a percentage.
4. WHEN a user adjusts the quantity of a cart item, THE NowCart_Frontend SHALL send the update to the NowCart_Backend cart operation endpoint and render the updated Confident_Cart.
5. WHEN the NowCart_Backend returns cart notes, THE Cart_Drawer SHALL display each note to the user.

### Requirement 7: Comparison Collapse and Confidence Display

**User Story:** As an undecided user, I want to see one recommended product with a short reason and a
confidence level, so that I do not have to compare similar items.

#### Acceptance Criteria

1. WHEN the Cart_Drawer displays a cart item, THE Cart_Drawer SHALL display the single-line reason that the NowCart_Backend provided for that item.
2. WHEN the Cart_Drawer displays a cart item, THE Cart_Drawer SHALL display that item's Confidence_Score as a percentage.
3. WHEN a user requests the decision detail for the cart, THE NowCart_Frontend SHALL display the Reasoning_Trail returned by the NowCart_Backend.
4. WHERE a cart item's Confidence_Score is at or above the Confidence_Threshold, THE Cart_Drawer SHALL render that item with a high-confidence visual indicator.
5. WHERE a cart item's Confidence_Score is below the Confidence_Threshold, THE Cart_Drawer SHALL render that item with a low-confidence visual indicator.

### Requirement 8: Human-in-the-Loop Clarification

**User Story:** As a user, I want to be asked a single question when the AI is unsure, so that the
final cart matches my intent.

#### Acceptance Criteria

1. WHEN a Confident_Cart response includes a clarification question, THE NowCart_Frontend SHALL display the clarification question as a HITL_Prompt.
2. WHEN a user answers a HITL_Prompt, THE NowCart_Frontend SHALL send the answer to the NowCart_Backend and render the resulting Confident_Cart.
3. WHILE a HITL_Prompt is displayed, THE NowCart_Frontend SHALL present at least one selectable answer option in addition to free text entry.
4. WHEN a user dismisses a HITL_Prompt without answering, THE NowCart_Frontend SHALL retain the current Confident_Cart unchanged.

### Requirement 9: Substitution Intelligence Display

**User Story:** As a shopper, I want to clearly see when an out-of-stock item was swapped and why, so
that I trust the substitution.

#### Acceptance Criteria

1. WHEN a Confident_Cart includes one or more Substitutions, THE Cart_Drawer SHALL display each Substitution showing the original product, the substitute product, and the reason.
2. WHEN a cart item is a substitute for an out-of-stock product, THE Cart_Drawer SHALL mark that item with a substitution indicator.
3. WHEN a user toggles a Stock_Override_Control for a product to out-of-stock, THE NowCart_Frontend SHALL send the override to the NowCart_Backend and the next assembled cart SHALL reflect the substitution.
4. WHEN a user rebuilds a cart after a stock override, THE NowCart_Frontend SHALL render the substitution within the Cart_Drawer without requiring a page reload.

### Requirement 10: SOS Emergency Mode

**User Story:** As a user in an urgent situation, I want a one-button emergency mode that builds the
fastest kit and a near-instant checkout, so that I get essentials as fast as possible.

#### Acceptance Criteria

1. WHEN a user activates SOS_Mode with a situation, THE NowCart_Frontend SHALL send the situation to the NowCart_Backend SOS endpoint and render the returned Confident_Cart.
2. WHILE SOS_Mode is active, THE NowCart_Frontend SHALL display an ETA_Countdown representing estimated delivery time.
3. WHEN an SOS Confident_Cart is rendered, THE Checkout_Flow SHALL allow order placement in two interactions or fewer.
4. WHEN SOS_Mode is displayed, THE NowCart_Frontend SHALL offer at least three preset emergency situations selectable in one interaction.
5. WHILE SOS_Mode is active, THE NowCart_Frontend SHALL apply a distinct urgency visual treatment that differs from the standard view.

### Requirement 11: Engine Progress and Narrative Visual

**User Story:** As a viewer of the demo, I want to see the "four doors into one brain into one cart"
flow while the AI works, so that the product story is clear and screenshot-worthy.

#### Acceptance Criteria

1. WHILE the Outcome_Engine is processing a request, THE Engine_Progress_View SHALL display the pipeline stages in order: decompose, match, optimize, substitute, confidence.
2. WHEN a pipeline stage completes, THE Engine_Progress_View SHALL mark that stage as complete.
3. WHEN a Confident_Cart is returned, THE Engine_Progress_View SHALL transition to the Cart_Drawer view.
4. THE NowCart_Frontend home view SHALL render a visual that depicts four Front_Doors converging into one Outcome_Engine and producing one Confident_Cart.
5. IF a request fails before a Confident_Cart is produced, THEN THE Engine_Progress_View SHALL display an error state with a retry control.

### Requirement 12: Checkout Flow

**User Story:** As a shopper with an assembled cart, I want a clear checkout, so that I can place my
order and see confirmation.

#### Acceptance Criteria

1. WHEN a user initiates checkout from the Cart_Drawer, THE Checkout_Flow SHALL display an order summary containing the cart items, total, and currency.
2. WHEN a user confirms an order, THE NowCart_Frontend SHALL submit the order to the NowCart_Backend and display an order confirmation containing an order identifier and estimated delivery time.
3. IF order submission fails, THEN THE NowCart_Frontend SHALL display an error message and retain the cart contents for retry.
4. WHEN the Cart_Drawer contains no items, THE Checkout_Flow SHALL disable the checkout control.

### Requirement 13: Backend Sync and API Contract

**User Story:** As a developer, I want the backend to expose every endpoint the revamped frontend
needs through one typed contract, so that the client and server never drift.

#### Acceptance Criteria

1. THE NowCart_Backend SHALL expose endpoints for each Front_Door: outcome, voice intent, constraint, vision photo, and shared link.
2. THE NowCart_Backend SHALL expose endpoints for cart retrieval, cart operations, SOS, stock override, order placement, and shared-cart retrieval.
3. WHEN any NowCart_Backend endpoint returns a Confident_Cart, THE response SHALL include items, total, currency, overall confidence, substitutions, notes, clarification, and a degraded flag.
4. WHEN the NowCart_Backend application starts, THE NowCart_Backend SHALL emit an API_Contract describing every endpoint and response schema.
5. WHEN the API_Contract changes, THE NowCart_Frontend SHALL derive its request and response TypeScript types from the API_Contract.
6. WHEN a NowCart_Backend endpoint encounters an internal error, THE NowCart_Backend SHALL return a consistent error response containing a message and the frontend SHALL render that message.

### Requirement 14: Visual Design, Accessibility, and Responsiveness

**User Story:** As any user, I want a polished, accessible, responsive interface, so that the
experience is beautiful and usable across devices and assistive technologies.

#### Acceptance Criteria

1. THE NowCart_Frontend SHALL apply one consistent design system covering color, typography, spacing, and component styling across all views.
2. WHERE the viewport width is below 768 pixels, THE NowCart_Frontend SHALL render all primary views in a layout that requires no horizontal scrolling.
3. WHEN an interactive control receives keyboard focus, THE NowCart_Frontend SHALL render a visible focus indicator on that control.
4. THE NowCart_Frontend SHALL provide text alternatives for non-text content used to convey state, including Front_Door icons and the Confidence_Score indicators.
5. WHEN the Cart_Drawer updates its contents, THE NowCart_Frontend SHALL announce the update to assistive technologies through a live region.
6. WHEN content state changes are conveyed by color, THE NowCart_Frontend SHALL also convey the same state through text or shape.

### Requirement 15: Demo Determinism and Resilience

**User Story:** As a presenter, I want repeatable, resilient demos, so that the four front doors, the
substitution moment, and SOS behave consistently on stage.

#### Acceptance Criteria

1. WHEN identical input is submitted through a Front_Door against the deterministic backend data, THE NowCart_Frontend SHALL render an equivalent Confident_Cart on each submission.
2. IF a NowCart_Backend request exceeds the configured timeout, THEN THE NowCart_Frontend SHALL display a timeout message with a retry control.
3. WHEN the NowCart_Backend returns a degraded response, THE NowCart_Frontend SHALL render the available cart and a degraded indicator rather than an error screen.
4. THE NowCart_Frontend SHALL expose the Stock_Override_Control in a demo surface so out-of-stock substitution can be triggered during a live demo.
