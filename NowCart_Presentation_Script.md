# NowCart — Grand Finale Presentation Script
### Amazon HackOn Grand Finale · Bangalore · Team Codyssey
Read naturally at ~130-150 wpm — don't rush.

**Timing note:** spoken narration across slides 1-5 and 7-12 runs ~9:30. Slide 6 now embeds the full ~3:30 demo video (self-narrated), which pushes total stage time to ~15:00. If your slot is a hard 10 minutes, trim the embedded video to a ~90s highlight cut (Show → Speak → Subscribe → Admin dashboard) rather than cutting narration elsewhere — the spoken script is already tight.

---

## Slide 1 — Title: "NowCart. Reimagining Urgent Shopping" — 0:30

**Narration:**

"Good [morning/afternoon], everyone. We're Team Codyssey — Rohan, Anuj, and I'm Baibhav — and we built NowCart.

Quick commerce already solved delivery. Groceries land at your door in ten minutes. But we noticed something every one of us has felt personally: you still spend just as long *deciding* what to put in the cart as you save on delivery.

So here's our thesis in one line: **quick commerce solved delivery. We solve the deciding.**"

*[Presenter note: pause a beat after the tagline — let it land before moving to the next slide.]*

---

## Slide 2 — The Bottleneck in Quick Commerce — 0:45

**Narration:**

"Let's put numbers on that. India has close to 300 million online shoppers today. On average, they spend five to seven minutes *per order* just searching for items, comparing variants, and hunting for substitutes when something's out of stock — that's RedSeer's 2025 data.

Every platform — Blinkit, Zepto, Instamart, Amazon Fresh — still makes you pick items one at a time. Nobody has automated the *decision*, only the *delivery*.

And the cost of that friction is real: seventy percent of online shopping carts get abandoned before checkout — Dynamic Yield, 2025. Seven out of every ten carts. That's lost revenue for the platform, and a frustrated user who just gives up.

Delivery is fast, automated, and solved. Deciding what to buy is still slow, manual, and completely unsolved."

---

## Slide 3 — Every Platform Searches. NowCart Reasons. — 0:45

**Narration:**

"So what does the old way actually look like? Three things break down every time. One — product-first search: you browse and select item by item, every single order, starting from zero. Two — out of stock means you're back to square one with no fallback. Three — no memory: your last twenty orders never inform your next cart.

NowCart flips all three. Instead of forcing a choice, we give an *informed* one — every item carries a NowCart Verified badge, based on what's most ordered and highest rated in that category, with zero brand bias and no hidden AI cherry-picking. When something's out of stock, we don't dead-end you — we show the best in-stock alternative *and* an economical option side by side, with the exact saving shown, and you decide. And because the engine is exposed as clean APIs, it's integration-ready — voice through something like Alexa, image capture through something like Amazon Photos — this plugs straight into existing ecosystems.

Every platform searches. NowCart reasons."

---

## Slide 4 — Understanding NowCart's Target Audience — 0:40

**Narration:**

"We designed this for three real kinds of shoppers. First — the never-in-the-kitchen crowd. They see a dish on Instagram or YouTube and want to make it, but have no idea what actually goes into it. Second — elderly and voice-first users, who struggle with text-heavy apps, small buttons, and multi-screen checkouts. And third — the general household shopper who knows exactly what they're cooking tonight but still burns five to seven minutes comparing brands and chasing substitutes.

Three different frustrations. One underlying problem — turning a need into a cart takes too much manual work. That's what we built NowCart to remove."

---

## Slide 5 — Five Ways In. One Confident Cart Out. — 1:00

**Narration:**

"This is the core idea of the whole product. Five doors in, one brain, one confident cart out.

*[Presenter note: gesture across the five icons on screen as you name them.]*

**Show** — snap a photo of a dish, and the ingredients get extracted and matched straight into a cart. **Share** — paste a recipe link or a YouTube URL, and the recipe gets parsed into a cart. **Speak** — say something like 'biryani for four' out loud, and the intent gets understood and built into a cart. **Budget** — set a number, say a thousand rupees for dinner for two, and the engine works backward to fit exactly that budget. And **Subscribe** — set recurring items, or literally do nothing, and we predict your restocks from your own purchase history before you even ask.

Underneath all five is one single reasoning engine — we call it the Outcome Engine. It doesn't matter which door you walk through — every input decomposes into structured needs and gets matched against the catalog. Different inputs, same brain, same guarantee: one ranked, verified, ready-to-checkout cart at the end. Consistent shopping experience, every single time."

---

## Slide 6 — Demo Video — 0:15 intro + ~3:30 video (self-narrated) + 0:15 close

*[Presenter note: this slide holds our embedded demo video, not a static screenshot. The video has its own voiceover, so once it starts, stop talking and let it run — your job here is a short spoken intro before it plays and one line after it ends. Have the video pre-loaded and volume-checked before you walk on stage.]*

**Intro narration (before pressing play):**

"Rather than click through the live app in front of you slide by slide, we recorded a walkthrough so you can see the full experience end to end — starting from sign-up, all the way through every one of the five doors, checkout, the catalog, and even our own admin dashboard. Let's play it."

*[Presenter note: press play. The video opens on the sign-up screen — age, gender, and region get captured there, which is the demographic signal our cold-start personalization engine uses to build a starter cart before a user's very first order. It then signs in as a returning user, Rahul, and walks through Show, Share, Subscribe, Speak, and Budget, checkout, the catalog, PWA install, and the admin dashboard.]*

**Close narration (right after the video ends):**

"That's the product, live and deployed — every screen you just saw is running today, not a mockup."

---

## Appendix — Demo Video Voiceover, Grand Finale Edit (synced to the 0:00–3:30 screen recording)

This replaces the generic demo-video VO track for the Amazon HackOn Grand Finale cut. Same screen actions and timestamps as your existing screen-recording script — narration is rewritten for a jury that includes AWS, Amazon Devices, and Amazon Pay: a few lines now tie each door to the Amazon ecosystem it most naturally extends, and every technical claim is corrected against the actual codebase (no raw confidence numbers spoken aloud, Budget described as trim-to-fit rather than fill-up, no over-claiming Redis is live). Re-record this track against the same screen capture, or use it as the presenter's live narration if you demo the app on stage instead of playing a video.

**[0:00–0:12] — Sign Up**
"When someone creates a NowCart account, we ask for age, gender, and region — not for marketing, but to build a personalised starter cart before they've placed a single order. Cold-start personalisation kicks in the moment you sign up."

**[0:12–0:25] — Sign In as Rahul**
"We'll sign in as Rahul — a returning user with real order history, so you can see the product at full strength."

**[0:25–0:38] — Home Page + Location**
"This is NowCart. Delivery location sits right in the top bar — change it in one tap. And these are our five doors: Show, Share, Subscribe, Speak, and Budget."

**[0:28–0:52] — Home Page (product intro, delivered here)**
"Quick commerce already solved delivery — groceries in ten minutes. But building the cart still takes just as long. NowCart fixes the deciding. Five doors, one brain, one confident cart. Tell it what you want — a meal, a budget, a dish photo, a recipe link — and one engine does the rest. Let's walk through all five."

**[0:38–1:05] — Show**
"First — Show. Snap a photo of any dish, and NowCart figures out exactly what to buy. I'm uploading a Paneer Masala photo. Under the hood, Gemini 2.0 Flash runs vision inference, extracts the ingredients, and maps every one of them straight to our catalog. The cart comes back ranked and verified in seconds — this is the same capability that would plug naturally into something like Amazon Photos."

**[1:05–1:25] — Share**
"Second — Share. Paste a recipe link or a YouTube URL, and NowCart parses it for you. I'm pasting a penne pasta recipe video. The backend extracts the ingredient list and builds the cart — no typing, no searching, just paste and get a cart."

**[1:25–1:50] — Subscribe**
"Third — Subscribe. This is where NowCart gets anticipatory. We tap 'Show my predicted restock,' and it analyses Rahul's purchase history to build a restock cart before he even asks — the same instinct behind Subscribe & Save, but derived automatically from behaviour, not a fixed schedule the user has to set up. From the menu we go to My Subscriptions — Rahul already has a few active. We add milk on a daily cycle. We tap 'Order subscriptions now,' and in the cart, that item is clearly tagged as coming from a subscription. Full transparency, no surprises."

**[1:50–2:12] — Speak**
"Fourth — Speak. Say a meal or a moment out loud — this is the door built for voice-first users, and it's the one that would extend most naturally onto a device like Alexa. We tap the mic and say: healthy breakfast for two people. The engine decomposes that intent and assembles a cart in seconds. We follow up — remove onions — and the cart updates live, right in the conversation."

**[2:12–2:30] — Speak → Refine → Order**
"We tap the Protein refine chip — it suggests swapping poha. We remove it, add idli instead. Cart refined. Place order, select a payment method, done."

**[2:30–2:48] — Budget**
"Fifth — Budget. Give it a number and a headcount — one thousand rupees, dinner for two. The engine builds the ideal cart first, then keeps the highest-confidence items that actually fit inside that budget. Every item also shows an Economical alternative alongside it — cheaper, though it may not carry the Verified badge — so the user always makes the final call. Place order, payment, done."

**[2:48–3:02] — Catalog + Search**
"Now the catalog — over nine thousand five hundred products across Fruits and Vegetables, Staples, Dairy, Snacks, Beverages, and more. Search for paneer, and the top result carries the NowCart Verified badge — most ordered and highest rated in that category. Tap any product for the full detail page."

**[3:02–3:12] — PWA Install**
"NowCart is a Progressive Web App — no app store needed. There's an Install button right in the header; tap it, and it lands on your home screen like a native app."

**[3:12–3:22] — Admin Dashboard**
"Logging in as admin gives us real-time observability — total requests, AI-assembled carts built, latency, error rate, and how often repeat queries get served from cache instead of hitting the model again. The Infra tab shows the full stack — Groq and Gemini for AI, DynamoDB for data, all running on AWS. Billing: zero dollars, fully within the Free Tier."

**[3:22–3:30] — GitHub + CI/CD**
"And here's the GitHub repo — a push here automatically builds the frontend, deploys it to S3 and CloudFront, and rolls the backend out to EC2. No manual steps. That's NowCart — five doors, one brain, one confident cart out."

---

## Slide 7 — Technical Architecture — 1:30

**Narration:**

"Let's go under the hood. Our architecture runs in seven coordinated layers.

Layer one — five entry points, exactly the five doors we just walked through: Subscribe, Show, Share, Speak, and Budget. Layer two is security and capture — each door has dedicated input handling: a vision API for photos, structured-data fetching for recipe links, speech-to-text for voice, a budget parser for constraints — all passing through SSRF guarding, rate limiting, and input sanitization before anything touches our core logic, because we take three untrusted input types — photos, links, and voice — completely seriously from a security standpoint.

Layer three is a decision layer that asks one question: does this need full cart assembly, or is it an exact product lookup? Layer four is the engine layer — our Outcome Engine decomposes the need, calls an LLM for region-aware reasoning based on where the user signed up from, and runs it against our retrieval pipeline: a bi-encoder for semantic search, a cross-encoder for re-ranking, and fuzzy matching underneath to catch typos — all converging into the Verified badge picks. If something's out of stock, a dedicated handler suggests the nearest alternative, but the user always decides — we never silently auto-swap.

Layer five is storage — DynamoDB for products, users, and orders; a caching layer for cart state, backed by the same one-hour TTL, hashed-prompt caching strategy you'd use with Redis. Layer six presents One Confident Cart — best pick plus economical alternative, badge, and reasoning attached. Layer seven takes that into checkout — place order, pick a payment method, confirmed. And notice the dashed line at the top: every completed order feeds back into order history, which is exactly what powers Subscribe's predictions for next time. The system genuinely learns from itself."

---

## Slide 8 — The NowCart Tech Stack — 1:15

**Narration:**

"On the frontend, React 19 with Vite and TailwindCSS — that gets us an instant, lag-free UI, which matters because five different interaction panels are all live on one page.

On the backend, FastAPI with Pydantic 2, fully async — built to handle over a thousand concurrent requests, and Pydantic validates every single piece of incoming data automatically, which blocks malicious input by default before it ever reaches business logic.

For AI and ML — LangGraph orchestrates our multi-node reasoning pipeline, backed by Groq running Llama 3.3 70B for text reasoning and Gemini 2.0 Flash for vision — and importantly, we built it provider-agnostic. We've also fully implemented an Amazon Bedrock path with Claude 3 Haiku, ready to flip on with a single environment variable change for production. On top of the LLM layer sits our hybrid retrieval stack — bi-encoder, cross-encoder, and fuzzy matching working together.

For data — DynamoDB, on-demand, zero capacity planning, and it directly powers our restock predictions from real order history. And for infrastructure — EC2, Nginx, S3, and CloudFront, so the frontend already serves from edge locations globally with no extra work.

*[Presenter note: this is a good moment to glance toward the AWS panel — Bedrock-readiness and DynamoDB/EC2/S3/CloudFront is squarely their world.]*

Put together — instant UI for shoppers, a backend that scales under load, an AI layer that reasons instead of just searching, a database that auto-scales with zero ops, and infrastructure that keeps us fast and responsive even at peak traffic."

---

## Slide 9 — Algorithms & Scaling Strategy — 2:45

**Narration:**

"We touched on the architecture a moment ago — this slide is where we go one level deeper into how every layer of that stack actually works, end to end, and how it holds up under real load.

Quick sweep across the stack first. Frontend is React 19 with Vite — each of our five door panels mounts and updates instantly, no perceptible lag even on a mid-range phone. Backend is FastAPI, fully async, with Pydantic validating every request shape automatically. Data lives in DynamoDB, on-demand, so we never provision capacity by hand. That's the foundation everything below sits on.

Now the reasoning layer, which is where most of our engineering actually went. It's a LangGraph multi-agent pipeline — a small graph of specialized nodes with one shared typed state passed between them: one node classifies intent, one decomposes the need into structured items using region-aware LLM reasoning, one handles retrieval and out-of-stock resolution, one scores overall cart confidence internally to decide if a retry is warranted. If confidence is too low, a replan node kicks in and routes back through the graph — capped at two passes, so it self-corrects once or twice and then commits, rather than looping forever chasing a perfect answer.

Feeding that pipeline is retrieval, and it's genuinely three techniques layered together, not one. A bi-encoder — a small sentence-transformer model — encodes our entire catalog of over nine thousand five hundred products into vectors once, up front. At query time it encodes the user's need the same way and pulls the twenty closest matches by cosine similarity, purely on meaning — so 'cottage cheese' already lands near paneer before any exact word match happens. A cross-encoder then takes that shortlist of twenty and re-ranks it properly — instead of comparing vectors from a distance, it looks at the query and each candidate *together*, pairwise, which is slower but far more precise, so it only ever runs on the small shortlist, never the full catalog. And underneath both, fuzzy string matching plus a hand-built synonym table catches what embeddings miss — plain typos like 'tomatoe,' and cross-language grocery terms like 'malai' correctly resolving to cream.

Three of our five doors also accept *untrusted* input directly — a photo, a pasted link, a voice recording — so security sits right at capture. Every recipe link we fetch goes through an SSRF guard that blocks requests to private and internal IP ranges, so a malicious URL can't be used to probe our own infrastructure. Every request is rate-limited per user, and every payload is validated by Pydantic before it ever reaches our reasoning logic — malformed or malicious input gets rejected at the door, not deep inside the pipeline.

Cost and latency are handled the same disciplined way. Every LLM prompt is hashed and cached for an hour, so a hundred identical queries cost one real model call and ninety-nine near-instant cache hits — the same hashing trick also caches cross-encoder re-rank results. And the genuinely slow AI calls — vision analysis, recipe parsing — are architected to offload onto Lambda through SQS, scaling to a thousand parallel executions, so one slow model call never blocks the API from responding fast to everyone else waiting in line.

Which brings us to scaling itself. The core design decision underneath all of it is that our API is completely stateless — cart state lives in a shared cache layer, never inside a single server process. That's what makes scaling mechanical instead of a rewrite. At a hundred times today's load, we put an Auto Scaling Group behind a load balancer — since any instance can serve any request, we just add instances on demand. At a thousand times today's load, we go multi-region — DynamoDB's Global Tables replicate our data so every region reads locally, and latency-based routing sends each user to their nearest region automatically. Our frontend needs zero extra work at either scale — S3 and CloudFront are already serving globally from edge locations today.

And underneath Subscribe — restock timing is predicted from pure statistics: we measure the gaps between a user's past purchases and score how *regular* that pattern is using coefficient of variation. No training data, no cold start, no black box — just genuinely explainable math."

---

## Slide 10 — Future Vision: Expansion Roadmap — 0:45

**Narration:**

"Here's where we take this next. In the first three months, we're targeting one thousand active users, three times faster cart assembly than manual browsing, and under fifteen percent cart abandonment.

Three to six months out, we scale to ten thousand-plus users and add multi-language voice — Hindi, Tamil, Bengali — which alone unlocks access for over five hundred million non-English speakers who quick commerce apps currently leave behind, alongside an over-the-counter pharmacy catalog integration using the exact same pipeline.

Six to twelve months, we're at twenty thousand-plus users, moving into enterprise restocking for restaurants and offices, travel and event kits, and a white-label API — turning every cart built into a licensing revenue stream, not just a consumer feature."

---

## Slide 11 — Multi-Segment Growth & Value Impact — 0:45

**Narration:**

"Here's the real punchline: our technical advantage isn't a grocery feature — it's a domain-agnostic engine. The exact same pipeline that turns 'biryani for four' into a grocery cart can turn 'my child has a fever' into a pharmacy cart, or a cooking reel into a shoppable cart through the same URL parsing we already demoed, or 'restock my restaurant for the week' into a B2B bulk order with budget limits.

At scale, that's over one point four billion global online shoppers, plus another two hundred million across these new segments — and voice and photo input alone unlock over one hundred million people who are excluded today by text-only apps.

Per user, we're giving back roughly twenty-six hours a year that used to go into deciding what to buy. At a million users, that's twenty-six million hours of human time returned. And because caching cuts model costs by up to ninety-nine percent on repeat queries, that scale doesn't get more expensive — it gets cheaper, while a white-label pricing model adds six-figure monthly licensing potential on top."

---

## Slide 12 — Thank You — 0:30

**Narration:**

"That's NowCart — five doors, one brain, one confident cart out. It's deployed and fully functional today — the source code, a demo video, and the live prototype are all linked here, and you're welcome to sign in and try it yourselves.

We're Team Codyssey, and we're reimagining urgent shopping with NowCart. Thank you — we'd love to take your questions."

*[Presenter note: end standing still, make eye contact with the jury panel, and pause — don't rush into Q&A.]*

---

## Quick reference — Live demo talking points (if the jury asks to see it live)

Use these exact, rehearsed inputs — they're the same ones proven in the demo video, so they render reliably on stage:

- **Show**: upload the Paneer Masala dish photo → cart with confidence score and Verified badges.
- **Share**: paste the penne pasta YouTube recipe URL → parsed ingredient cart.
- **Speak**: say "healthy breakfast for two people" → cart builds live; follow up with "remove onions" to show refinement; use the cart drawer's Protein chip to show a swap suggestion (poha → idli).
- **Budget**: ₹1000, dinner, 2 people → cart fits the budget; tap an item's Economical alternative to show the cheaper in-stock swap alongside the recommended pick.
- **Subscribe**: tap "Show my predicted restock," then go to My Subscriptions, add milk on a daily cycle, then "Order subscriptions now" to show the subscription tag in cart.
- **Admin dashboard**: log in as `admin@nowcart.app` to show live observability — total requests, carts built, latency, error rate, LLM cache hit ratio, and the Infra & Cost tab (AI providers, AWS region, $0 free-tier billing).

**If a technical judge asks a pointed question, these are the honest, defensible answers:**
- *"Is this actually running on Bedrock?"* — "Today's live demo runs on Groq and Gemini for speed and cost during the hackathon. We've fully built and tested an Amazon Bedrock path with Claude 3 Haiku — switching providers is a one-line environment variable change, since we built the whole LLM layer behind a provider abstraction from day one."
- *"How many nodes in your reasoning graph?"* — "It's a multi-node LangGraph pipeline — intent classification, decomposition, retrieval and matching, confidence scoring, and a self-correcting replan loop capped at two passes so it never runs away chasing a perfect answer."
- *"Is caching live on Redis right now?"* — "The caching layer is Redis-compatible and built for it — one-hour TTL, SHA-256-hashed prompts — for this deployment we're running it in-memory to keep the hackathon footprint simple, and swapping in a live Redis instance is a config change, not a rebuild."
