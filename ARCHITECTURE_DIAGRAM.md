# NowCart — High-Level Architecture

```mermaid
flowchart TD

%% ─── LAYER 1: FRONT DOORS ───────────────────────────────────────────
subgraph L1["① FRONT DOORS — five ways in"]
  direction LR
  D1["🔗 Share\npaste link / YT video"]
  D2["📷 Show\nsnap a dish photo"]
  D3["🎤 Speak\n'biryani for 4'"]
  D4["💰 Constrain\n'dinner under ₹500'"]
  D5["🔁 Subscribe\nmilk daily · bread weekly"]
end

%% ─── LAYER 2: CAPTURE ───────────────────────────────────────────────
subgraph L2["② CAPTURE / INPUT PROCESSING"]
  direction LR
  C1["Share → fetch + JSON-LD + LLM extract"]
  C2["Show → Gemini Vision"]
  C3["Speak → Speech-to-Text"]
  C4["Constrain → Budget Parser"]
  C5["Subscribe → Interval / Schedule Engine"]
end

L1 --> L2

%% ─── LAYER 3: SECURITY ──────────────────────────────────────────────
subgraph L3["③ SECURITY GATEWAY  (FastAPI)"]
  S1["Input validation · URL / SSRF guard · Rate limit"]
end

L2 --> L3

%% ─── LAYER 4: DECISION ──────────────────────────────────────────────
subgraph L4["④ DECISION"]
  direction LR
  YES["YES → needs a cart assembled\n→ Outcome Engine"]
  NO["NO → exact item selected\n→ straight to cart"]
end

L3 --> L4

%% ─── LAYER 5: OUTCOME ENGINE ────────────────────────────────────────
subgraph L5["⑤ OUTCOME ENGINE  (LangGraph)"]
  direction LR
  E1["intent → decompose\n─► Groq LLM (region-aware)\n   South → idli · North → poha"]
  E2["pantry filter\n(skip what you already have)"]
  E3["match → confidence check\n⟲ replan loop ≤ 2"]
  E1 --> E2 --> E3
end

YES --> L5

%% ─── LAYER 6: SUGGESTION / RETRIEVAL ───────────────────────────────
subgraph L6["⑥ SUGGESTION / RETRIEVAL"]
  direction LR
  R1["Bi-encoder\ntop-20 by meaning"]
  R2["Cross-encoder re-rank"]
  R3["Rapidfuzz fallback\ntypo handling"]
  R4["✅ Verified-badge picks\nmost ordered + ratings"]
  R1 --> R2 --> R3 --> R4
end

L5 --> L6
L6 -->|"ranked picks back"| L5

%% ─── LAYER 7: STORAGE ───────────────────────────────────────────────
subgraph L7["⑦ STORAGE  (shared · bidirectional)"]
  direction LR
  DB[("DynamoDB\nproducts · users · orders")]
  RD[("Redis\ncart · session · LLM cache")]
end

L5 <-->|"read / write throughout"| L7
L6 <-->|"catalog reads"| L7
L4 -->|"NO path — action logged"| L7

%% ─── LAYER 8: PRESENT TO USER ──────────────────────────────────────
subgraph L8["⑧ PRESENT TO USER  — One Confident Cart"]
  P1["Ranked picks · ✅ Verified badge · Economical alternative · Confidence % · Reasons"]
  P2["Out-of-stock suggestion: 'You may also add X' — user decides"]
end

L5 --> L8
L4 -->|"NO — direct"| L8
L8 -. "user refines" .-> L5

%% ─── LAYER 9: CHECKOUT ──────────────────────────────────────────────
subgraph L9["⑨ CHECKOUT  — final step"]
  K1["Place Order → Select Payment Method → Order Confirmed"]
  K2["writes Orders to DynamoDB\n→ feeds Subscribe predictions + pantry awareness"]
end

L8 --> L9
L9 -->|"order history"| L7
L9 -. "loop: feeds Subscribe + pantry" .-> L1
```

---

## 1-minute walkthrough

| Layer | What you say |
|-------|-------------|
| ① Doors | "Five ways in — paste a link, snap a photo, speak, set a budget, or subscribe." |
| ② Capture | "Each door turns its input into structured intent — photo goes to Gemini, a link gets fetched and parsed, voice becomes text." |
| ③ Security | "Every input is validated and sanitised — malicious URLs are blocked here." |
| ④ Decision | "If the user already picked an exact item it goes straight to the cart. Otherwise the engine assembles one." |
| ⑤ Engine | "The engine decomposes the need with a region-aware LLM, filters pantry items you already own, then matches products." |
| ⑥ Retrieval | "Products are ranked by meaning using semantic search, re-ranked, and filtered by our Verified badge — most ordered + highest rated." |
| ⑦ Storage | "DynamoDB and Redis are read and written throughout — products, users, orders, cart state, and LLM cache." |
| ⑧ Present | "One confident cart: ranked picks with a Verified badge, an economical option, confidence scores, and reasons. Out-of-stock items are suggested — the user decides." |
| ⑨ Checkout | "Place order, select payment, confirmed. The order history loops back to feed Subscribe predictions and pantry awareness for next time." |
