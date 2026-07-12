# NowCart — Grand Finale Presentation Script
## HackOn with Amazon | In-Person | Team Codyssey
### Rohan Singh · Anuj Kumar Yadav · Baibhav Kundu

---

> **Format note:** This script is written slide-by-slide, with exact spoken words, delivery cues [in brackets], and technical depth to answer follow-up questions from AWS, Amazon Devices, and Amazon Pay judges. Read it aloud at a conversational pace — not robotic, not rushed.

---

## SLIDE 1 — Title Slide: NowCart
### *"Reimagining Urgent Shopping — Quick commerce solved delivery. We solve the deciding."*

**[One speaker opens. Warm, confident, not reading.] [~30 seconds]**

---

Good morning everyone. We are Team Codyssey — Rohan, Anuj, and Baibhav — and we built **NowCart**.

Quick commerce already solved the hardest part of the problem. Ten-minute delivery — that's done. What nobody has solved is the two to seven minutes *before* that. The part where you're staring at a screen, searching item by item, comparing six variants of ghee, hitting out-of-stock dead ends and starting over.

That's the cart-building bottleneck. And that's exactly what NowCart fixes.

**Quick commerce solved delivery. We solve the deciding.**

---

## SLIDE 2 — The Bottleneck in Quick Commerce

**[~45 seconds. Own these numbers. Don't read them — state them as facts you know deeply.]**

---

Let's talk about the scale of this problem.

India has over 300 million online shoppers. According to RedSeer 2025, they spend **5 to 7 minutes per order** just searching, comparing variants, and hunting for substitutes when something is out of stock.

Meanwhile, every platform — Blinkit, Zepto, Instamart, Amazon Fresh — still forces you to pick items **one by one**. There is no intelligence at the cart-building step. None.

The result? **70% cart abandonment** — Dynamic Yield 2025. Seven out of ten users who start building a cart never complete checkout. That's not a payment problem. That's a friction problem. That's a *deciding* problem.

Delivery is fast, automated, and solved.

**Deciding what to buy is still slow, manual, and unsolved.**

NowCart is the fix.

---

## SLIDE 3 — Every Platform Searches. NowCart Reasons.

**[~60 seconds. This is the core positioning slide. Make the contrast land hard.]**

---

Let me walk you through the key differences — the old way versus the NowCart way.

**One. Informed choice, not forced choice.**

Old way: manual browsing, item by item, every single order. Our way: the NowCart Verified badge. Every product in our catalog earns a badge based on a transparent formula — 50% weight on order volume in the last 30 days within the category, 50% weight on average rating. No brand pays for that badge. No hidden AI selection. The user sees the single best pick, not twenty lookalikes.

**Two. Recommended plus Economical, always.**

Old way: out-of-stock means start over from scratch. Our way: every cart presents two views simultaneously — a Recommended pick for the best quality match, and a cheaper in-stock Economical alternative with the exact saving shown in rupees. The user always decides. We never auto-swap silently.

**Three. Integration-ready.**

Old way: past orders don't inform the next cart. Every session starts from zero. Our way: voice via the Web Speech API tuned to Indian English — `lang: en-IN` — image analysis via Gemini Vision, URL parsing, and the entire engine is exposed as an API that plugs into existing ecosystems.

Every platform *searches*. NowCart *reasons*.

---

## SLIDE 4 — Understanding NowCart's Target Audience

**[~45 seconds. Keep this human and relatable.]**

---

We built for three users who are underserved by every current platform.

**Never-in-the-Kitchen People.** They saw a dish on Instagram or YouTube. They want to cook it. They don't know the recipe, they don't know the ingredients. Today, that means fifteen minutes of googling before they even open a grocery app. With NowCart — they paste the link, they snap a photo. Done.

**Elderly and voice-first users.** Small buttons, text-heavy interfaces, multi-screen flows — these exclude a massive population. India has an estimated 100 million-plus users locked out of text-only apps. NowCart's Speak door — you just say "dal chawal for 2" and the cart is built. No typing needed.

**General Household Shoppers.** They know what to cook. They just burn 5 to 7 minutes on every order searching, comparing brands, handling out-of-stock. With NowCart's Subscribe and Constrain features, the system builds the cart before they even open the app.

All three users. One engine. One confident cart out.

---

## SLIDE 5 — Five Ways In. One Confident Cart Out.

**[~90 seconds. This is your product architecture slide. Walk each door clearly and connect them to the Outcome Engine.]**

---

This is the heart of NowCart. **Five input doors, one reasoning engine, one cart out.**

Every door feeds the same backend pipeline — what we call the Outcome Engine — which runs: **decompose → match → score**. Let me walk you through each door.

**Show.** Snap a photo of any dish. Gemini 2.0 Flash runs vision inference on the image, identifies the dish and every visible and implied ingredient, estimates servings, and returns structured JSON. That JSON is passed directly into the LangGraph pipeline, which maps each ingredient against our catalog of 9,534 products.

**Share.** Paste a YouTube link, a recipe blog URL, even an Instagram reel. Our backend uses `httpx` to fetch the page content, strips the HTML, and feeds the extracted text to the LLM, which returns: "Making penne pasta — I need these ingredients." That string then enters the same pipeline as any other input.

**Speak.** You say "biryani for 4." The Web Speech API captures the audio — configured for `en-IN` locale to handle Indian English natively — converts it to text, the LLM classifies the intent, and the pipeline decomposes it into individual ingredient needs, scaled for 4 servings.

**Constrain.** Set a budget — say ₹1000. The full outcome pipeline runs first, then a greedy confidence-sorted knapsack algorithm trims items from the bottom of the confidence ranking until the total fits within budget. High-confidence essential picks always survive the cut.

**Subscribe.** This is the anticipatory door. For returning users, the system computes inter-purchase intervals from order history, measures regularity using coefficient of variation scoring, and projects depletion. It pre-builds a restock cart *before* the user even asks. For first-time users with no history, it uses their age, gender, and region from signup to build a personalised starter cart — cold-start solved at day zero.

All five doors. Same engine. **One Confident Cart — Ranked, Verified, Ready to checkout.**

---

## SLIDE 6 — App Screenshot: Sign Up / Sign In

**[~30 seconds. Quick — connect the UI to the intelligence.]**

---

The sign-up screen collects Name, Age, Gender, and Region. These aren't just profile fields — they directly feed the Subscribe feature's cold-start personalisation.

A 25-year-old male user in North India gets base staples like atta, dal, and rice, plus region-specific additions like mustard oil and rajma, plus age and gender tweaks — eggs, peanut butter, protein options.

A senior user gets dalia, moong dal, and digestive biscuits.

The intelligence starts the moment you create an account. There's also a **Continue as Guest** path — no friction for users who just want to try it.

---

## SLIDE 7 — Technical Architecture

**[~90 seconds. This slide has the most depth. Walk the layers clearly. Judges from AWS will want to understand every box.]**

---

Let me walk the architecture. We have six layers.

**Layer 1 — Feature Layer.** The five input doors: Subscribe, Show, Share, Speak, and Constrain. Each door is a React component that captures input and forwards it to the security layer.

**Layer 2 — Security and Capture Layer.** Every input, regardless of door, passes through four processors:
- The Vision API for image inputs — Gemini 2.0 Flash
- JSON-LD and httpx fetching for recipe links
- Web Speech API for voice input
- Budget Parser for monetary constraints

After capture, there's a **Security Validation** step — SSRF guard that blocks private IP ranges (preventing server-side request forgery), rate limiting, and Pydantic 2 input sanitization. Pydantic blocks malformed or malicious payloads before they ever reach the AI layer.

**Layer 3 — Decision Layer.** A single decision gate: does this input need *cart assembly* — goal-based like "biryani for 4" — or is it an *exact product lookup*? The branching keeps simple searches fast and complex needs routed to the full engine.

**Layer 4 — Engine Layer (Planning and Retrieval).** This is where the intelligence lives.

The **Outcome Engine** runs a 10-node LangGraph graph: Intent → Decompose → Match → Confidence → Counterfactual → Replan. It has a self-correcting replan loop capped at 2 passes, so it's never brittle.

The **Retrieval Pipeline** is three stages: first, a bi-encoder (all-MiniLM-L6-v2) encodes the query and all products into vectors and does cosine similarity to shortlist the top 20 by semantic meaning. Second, a cross-encoder (ms-marco-MiniLM-L-6-v2) re-ranks those 20 by pairwise comparison. Third, if the cross-encoder confidence is low, rapidfuzz catches typos as a fallback — so "tomatoe" still finds tomato, "malai" still finds cream.

The **Out of Stock Handler** — a product being out of stock *suggests* an alternative. It never auto-swaps silently. The user always sees both options and decides.

**Layer 5 — Storage Layer.** DynamoDB for products, users, and orders — all accessed via a clean repository abstraction layer that never exposes data stores directly. Redis for cart state, session cache, and LLM response caching.

**Layer 6 — Checkout and Order Layer.** Place Order → Payment Method Selection → Order Confirmed → Storage. The full order history then feeds back as a dashed line to the Subscribe layer — closing the loop.

---

## SLIDE 8 — The NowCart Tech Stack

**[~60 seconds. Hit each technology, explain the *why* not just the *what*.]**

---

Let's be specific about the tech.

**Frontend: React 19 + Vite + TailwindCSS.** React 19's concurrent rendering keeps all five front-door panels instant even on mid-range phones. Vite gives us sub-100ms hot reloads in dev. TailwindCSS keeps the bundle small — fast load even on patchy connections. It's also deployed as a **Progressive Web App** — users can tap Install from their browser and it lands on their home screen like a native app, no App Store required.

**Backend: FastAPI + Pydantic 2, fully async.** FastAPI's async event loop handles thousands of simultaneous cart requests without blocking. Pydantic 2 validates every request schema before it touches business logic — malicious input is rejected at the model layer, not the handler.

**AI/ML: LangGraph + Groq (Llama 3.3 70B) / Gemini 2.0 Flash / Bedrock (Claude 3 Haiku) + pure-NumPy TF-IDF and rapidfuzz.** LangGraph drives the multi-agent reasoning graph. The LLM layer is abstracted behind a provider interface — swapping from Groq to Bedrock is a single environment variable. The hybrid retrieval uses two 80MB models that run on-server — no external embedding API calls, no latency, no cost.

**Database: DynamoDB on PAY_PER_REQUEST.** Auto-scales reads and writes with zero provisioning. Global Tables extend it across regions. Order history stored here directly powers the Subscribe predictive restock.

**Infrastructure: EC2 + Nginx + S3 + CloudFront + Redis, with Lambda + SQS designed for scale.** Frontend is served from S3 via CloudFront edge locations globally. Redis caches cart state and LLM responses — each prompt is hashed to a 1-hour Redis entry, so 100 identical queries cost exactly 1 model call and 99 sub-millisecond cache hits. Lambda + SQS is designed for offloading slow AI calls — vision at ~3 seconds and recipe parsing at ~2 seconds — decoupling AI processing time from API response time entirely.

---

## SLIDE 9 — Algorithms & Scaling Strategy

**[~90 seconds. This is your deepest technical slide. Judges from AWS and Amazon Devices will probe here.]**

---

Let me go deeper on the algorithms.

**LangGraph Multi-Agent Pipeline.** A 10-node reasoning graph with shared typed state. The nodes are: intent classification, region-aware decomposition, hybrid retrieval matching, NowCart Verified badge assignment, confidence scoring, counterfactual generation, and a replan loop capped at 2 passes. Each node builds on the last — composable, debuggable, not one brittle mega-prompt.

The decompose node is **region-aware and demographic-aware**. If a user is from South India, the system biases toward idli, dosa, coconut oil, tamarind. North India — mustard oil, rajma, paratha. It uses user age and gender from signup to adjust recommendations — a senior user gets easy-to-cook, health-conscious options. A young adult gets protein-forward suggestions. No assumptions, user-disclosed profile, transparent reasoning.

**Hybrid Retrieval — Bi-encoder + Cross-encoder + Rapidfuzz.** Stage 1: the bi-encoder does an O(N) cosine similarity pass using `np.argpartition` — partial sort, not full sort, so it's genuinely fast at catalog scale. Stage 2: cross-encoder re-ranks the shortlist of 20 by pairwise comparison. Stage 3: if the top cross-encoder score is below confidence threshold, rapidfuzz supplements — catching typos and cross-language matches like "cottage cheese → paneer" semantically and "tomatoe → tomato" by edit distance.

**Confidence-Sorted Budget Fill (Constrain door).** Items are sorted descending by confidence and kept greedily until the budget runs out. The highest-confidence picks always survive. Lowest-confidence items are dropped. Complexity: one sort, one pass.

**Subscribe — Predictive Restock.** Pure statistics, no ML training, no cold start. For each product a user has bought at least twice: compute inter-purchase intervals in days, calculate mean and coefficient of variation. CV close to zero means the user buys it on a very regular schedule — high confidence. CV high means irregular — low confidence. Project days to depletion. If a product is due within 7 days, it enters the predicted cart. Final confidence bonus if the product is overdue — you're probably already out. No model training. No GPU. No cold-start problem.

**LLM Response Caching.** Each prompt is hashed deterministically to a 1-hour Redis entry. "Biryani for 4" from user A and user B hits the same cache entry — one model call, one inference cost, both users served instantly. This is how we cut model costs by up to 99% on repeat common intents.

**Scaling path.** The API is stateless — cart state lives in Redis, not the server process, so any EC2 instance can serve any request. At 100x scale: Auto Scaling Group behind a load balancer. At 1000x: multi-region groups with latency-based routing, DynamoDB Global Tables for fast regional reads. Frontend already global — S3 + CloudFront, no change needed.

---

## SLIDE 10 — Future Vision: Expansion Roadmap

**[~60 seconds. Show ambition but keep it grounded.]**

---

Here's where this goes.

**0 to 3 months.** We're already live. Target: 1000 active users, 3x faster cart assembly versus manual, under 15% cart abandonment. The five doors, all functional. Grocery, one Indian metro.

**3 to 6 months.** 10,000 users. Pharmacy and OTC catalog integration — "child has a fever" becomes a cart of OTC wellness items, hydration, comfort products — strictly non-prescription, from licensed pharmacy partners only. Multi-language voice — Hindi, Tamil, Bengali — which removes the language barrier for 500 million-plus non-English speakers in India.

**6 to 12 months.** 20,000-plus users. B2B restocking — "restock my restaurant for the week" — bulk carts with quantity scaling, budget limits, recurring auto-orders. White-label API licensing — platform partners pay per cart built. Licensing revenue per cart built, with the horizontal "need → done" layer proven.

**The longer vision.** Creator commerce — any YouTube cooking video or Instagram reel becomes a shoppable cart. Travel and event kits — "camping trip for 6" builds a single cart across food, supplies, and gear.

The key insight is that **adding a vertical is a catalog swap and a prompt change, not an architecture rebuild**. The engine is category-agnostic. Any domain where humans have a goal but face product overload is addressable with the same pipeline.

---

## SLIDE 11 — Multi-Segment Growth & Value Impact

**[~45 seconds. Quantify the impact clearly.]**

---

Let me quantify what NowCart actually delivers.

**Users reached.** 1.4 billion-plus global online grocery shoppers. 71 million-plus in India today. Multi-segment expansion adds 200 million-plus across pharmacy, B2B, and travel. Voice and photo input specifically unlocks an estimated 100 million-plus users currently excluded by text-only interfaces — elderly users, visually impaired users, non-English speakers.

**Time saved.** 10 minutes per session, 3 sessions per week, 52 weeks. That's approximately **26 hours returned per user per year.** At 1 million users — 26 million hours of human time given back annually.

**Efficiency gains.** Confident carts with pre-resolved out-of-stock items directly attack the 70% cart abandonment problem. LLM response caching cuts up to 99% of redundant model calls — so cost stays flat even as repeat queries scale.

**Revenue potential.** White-label "cart-built" pricing: at a few cents per cart and 10 million carts per month, that's a six-figure monthly licensing revenue stream, on top of faster carts driving higher order frequency and GMV for platform partners.

Our technical advantage is a **domain-agnostic engine that scales without rebuilds.**

---

## SLIDE 12 — Thank You / Links

**[~30 seconds. Close strong. Make it memorable.]**

---

We've shown you the problem — 5 to 7 minutes of friction on every quick commerce order. We've shown you the engine — five doors, LangGraph reasoning, hybrid retrieval, transparent confidence scores, verified badges, predictive restock. And we've shown you a live, fully deployed prototype running on AWS today.

NowCart is not a better search box. It's the layer that turns a human need directly into a checkout-ready cart.

**Quick commerce solved delivery. We solve the deciding.**

We're Team Codyssey — Rohan, Anuj, and Baibhav. We'd love to take your questions. Thank you.

---

---

# FOLLOW-UP Q&A PREP

*These are the questions Amazon judges are most likely to ask. Have answers ready.*

---

**Q: How does the NowCart Verified badge actually work? Who decides what gets verified?**

A: Fully algorithmic, no human curation, no brand payments. Badge score = 50% normalized order volume within category in last 30 days + 50% product average rating divided by 5. A product earns the badge when that composite score hits 0.6 or above. The badge service is triggered by a POST to `/api/admin/badges/recompute` and updates live from actual order data. Exponential moving average on ratings with alpha 0.2 so old ratings phase out gradually.

---

**Q: What happens if the LLM is down or slow?**

A: Three layers of fallback. First, LLM response caching means common intents like "biryani for 4" never hit the model on repeat — they're Redis cache hits. Second, the retrieval pipeline has a fuzzy-only fallback path — if neural models aren't loaded, rapidfuzz alone still returns relevant products. Third, the LangGraph pipeline has graceful degradation built in — if any step fails, the pipeline skips it and continues with what it has. The `degraded` flag on the Cart model surfaces this transparently to the user.

---

**Q: How do you handle out-of-stock in practice?**

A: The match node in the LangGraph pipeline populates `out_of_stock_suggestion` metadata on the CartItem when the best candidate is unavailable. The Out of Stock Handler suggests a semantic alternative but never auto-swaps. The user sees both the original pick and the suggested alternative, with a clear label. The `substituted_for` field on CartItem tracks any swap transparently. The reasoning trail and "Why this item" disclosure always explain what happened.

---

**Q: What is the "Why this one" feature?**

A: Every cart item has a "Why this item was suggested" disclosure — a collapsible panel that shows the customer-friendly reasoning: "Top-rated pick — highest match confidence for this ingredient," or "Original choice was out of stock — swapped to the nearest in-stock equivalent." The frontend filters out all internal engine strings (scores, node names, thresholds) and surfaces only human-readable explanations. Transparency without noise.

---

**Q: How does the Subscribe feature work for a brand new user with zero order history?**

A: Cold-start is solved with demographic personalisation from signup. The `predict_restock` function checks order count. If fewer than 2 orders, it calls `_build_new_user_starter_cart`. The pool of items is built as: base staples (full cream milk, toor dal, basmati rice, sunflower oil, atta, sugar, salt, onion) + region additions (South India gets coconut oil, tamarind, mustard seeds; North India gets mustard oil, rajma, amul butter, paneer) + age group additions (young adult gets eggs, oats, coffee; senior gets dalia, moong dal, digestive biscuits) + gender additions (opt-in, female gets spinach, fenugreek, dates; male gets eggs, peanut butter, chana dal). Confidence is set to 0.75 — lower than pattern-based, but clearly labelled as a starter suggestion.

---

**Q: Can the cart be refined conversationally after it's built?**

A: Yes. The cart has a refine input bar at the bottom. "Remove onions" — the replan node runs in augment mode: it preserves all existing items as locked, identifies only the net change from the feedback, and adds or removes accordingly. The decompose node in augment mode explicitly receives the existing cart and the feedback text and returns only the delta — it never rebuilds from scratch. The meal context is preserved so if a user says "add protein" on a pasta cart, the system adds chicken breast, not sardines.

---

**Q: How is the app deployed? What does the CI/CD look like?**

A: GitHub Actions on push to `master` or `prod_dev`. Job 1 builds the React frontend with Vite, syncs the `dist/` folder to S3 bucket `nowcart-frontend-strizzy`, and invalidates the CloudFront distribution `E12DWQGXBDIMR3`. Job 2 runs after Job 1 succeeds — SSHes into EC2, pulls the latest commit, writes `.env` from GitHub Secrets, and restarts the FastAPI backend via `systemctl`. Frontend is globally served from CloudFront edge locations. Backend runs as a systemd service behind Nginx.

---

**Q: What is the admin dashboard showing in real time?**

A: Total requests, carts built, average latency, P50/P95 latency percentiles, error rate, and LLM cache hit ratio — how many requests were served from Redis versus hitting the actual model. The Infra tab shows AI providers in use (Groq with Llama 3.3 70B for text, Gemini 2.0 Flash for vision), backends (DynamoDB, Redis, AWS region ap-south-1), and live AWS billing via Cost Explorer API — showing actual spend, with the current deployment running on Free Tier. Auto-refreshes every 5 seconds.

---

**Q: Why LangGraph specifically? Why not a single LLM prompt?**

A: A single mega-prompt is brittle and undebuggable. LangGraph gives us a typed state graph where each node has a clear contract — input types in, output types out — and failure in one node doesn't break the whole pipeline. The self-correcting replan loop lets the system refine a low-confidence cart without the user re-entering their request. The shared typed state means every node has full context — intent mode, servings, user region, excluded items, locked items, constraints — without passing giant strings. And because each node is a Python function, we can test them independently and trace the reasoning trail at every step.

---

**Q: How do you address the Amazon integration angle (Alexa, Amazon Photos)?**

A: The architecture is explicitly integration-ready. The Speak door uses Web Speech API today — the same flow works with Alexa's intent payload, which is just structured text. The Show door uses Gemini Vision today — Amazon Photos or the Amazon Shopping app camera can POST image bytes to `/api/vision/analyze` and get a cart back. The entire Outcome Engine is exposed as a REST API — any Amazon product (Fresh, Now, Alexa Shopping Lists) can call it with a text or structured intent and receive a ready-to-checkout cart. The provider abstraction means the backend can swap to Bedrock for all AI calls with a single environment variable — which is the natural AWS-native path at scale.

---

*End of Script*
