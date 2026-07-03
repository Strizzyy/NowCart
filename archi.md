# NowCart — Hybrid System Architecture

> One engine, five doors, one confident cart, then checkout.
> Layer-by-layer hybrid diagram showing both high-level flow and key implementation details.

```mermaid
flowchart TB
    %% ================= L1: FEATURES =================
    subgraph L1["① Feature Layer — Five Entry Points"]
        direction TB
        FrontDoors["🔗 Share · 📷 Show · 🎤 Speak · 💰 Constrain · 🔁 Subscribe<br/><i>recipe link · dish photo · voice input · budget · recurring order</i>"]
    end

    %% ================= L2: SECURITY & CAPTURE =================
    subgraph L2["② Security & Capture Layer — FastAPI Gateway"]
        direction TB
        Capture["<b>Input Capture</b><br/>Vision API · JSON-LD fetch<br/>Speech-to-Text · Budget parser"]
        Security["<b>Security Validation</b><br/>SSRF guard (block private IPs)<br/>Rate limiting · Input sanitization"]
    end

    %% ================= L3: DECISION =================
    subgraph L3["③ Decision Layer"]
        Decision{"<b>Needs Cart Assembly?</b><br/>exact product vs. needs-based"}
    end

    %% ================= L4: ENGINE =================
    subgraph L4["④ Engine Layer — Reasoning & Retrieval"]
        direction TB
        Engine["<b>Outcome Engine</b><br/>Decompose → Match → Optimize → Confidence<br/><i>builds one confident cart</i>"]
        Retrieval["<b>Retrieval Pipeline</b><br/>① Bi-encoder (semantic search)<br/>② Cross-encoder (re-rank)<br/>③ Rapidfuzz (fuzzy match)<br/>→ VERIFIED badge picks"]
        LLM["<b>Groq LLM</b><br/>Region-aware reasoning<br/>(from user signup location)"]
        OOS["<b>Out of Stock Handler</b><br/>→ Suggest alternative<br/><i>user decides, never auto-swap</i>"]
    end

    %% ================= L5: STORAGE =================
    subgraph L5["⑤ Storage Layer"]
        Storage["<b>Shared Data Stores</b><br/>DynamoDB: products · users · orders<br/>Redis: cart state · cache · sessions<br/><i>accessed via service layer — never exposed directly</i>"]
    end

    %% ================= L6: CART =================
    subgraph L6["⑥ Cart Presentation Layer"]
        Cart["<b>One Confident Cart</b><br/>Best pick · Economical alternative<br/>VERIFIED badge · Confidence % + reasoning"]
    end

    %% ================= L7: CHECKOUT =================
    subgraph L7["⑦ Checkout & Order Layer"]
        Checkout["<b>Checkout Flow</b><br/>Place Order → Payment method selection<br/>→ Order confirmed → Storage"]
    end

    %% ================= MAIN FLOW =================
    FrontDoors --> Capture
    
    Capture --> Security
    Security --> Decision
    
    Decision -->|"YES — assemble cart"| Engine
    Decision -->|"NO — exact product"| Cart
    
    Engine <--> Retrieval
    Engine <--> LLM
    Engine <--> Storage
    Retrieval <--> Storage
    
    Engine --> Cart
    Cart --> Checkout
    Checkout --> Storage

    %% ================= OPTIONAL PATHS (dotted) =================
    Retrieval -.->|"out of stock"| OOS
    OOS -.-> Cart
    Cart -.->|"refine / edit cart"| Engine
    Checkout -.->|"order history feeds"| FrontDoors

    %% ================= STYLES =================
    classDef layer fill:#fffbe6,stroke:#e6c200,stroke-width:2px,color:#333;
    classDef box fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b;
    classDef store fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b;
    classDef decide fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#7f1d1d;

    class L1,L2,L3,L4,L5,L6,L7 layer;
    class Share,Show,Speak,Constrain,Subscribe,Capture,Security,Engine,Retrieval,LLM,OOS,Cart,Checkout box;
    class FrontDoors box;
    class Storage store;
    class Decision decide;
```

---

## Presentation Script (1 minute)

"Our system has **seven clean layers**. 

**① Feature Layer**: Five entry points — Share a link, Show a photo, Speak your need, Constrain by budget, or Subscribe for recurring orders. Each with a real-world example.

**② Security & Capture**: FastAPI gateway that captures input using Vision API, JSON-LD parsing, speech-to-text, and validates everything with SSRF guards and rate limiting.

**③ Decision Layer**: We decide — is this an exact product click, or does the user need us to build a cart?

**④ Engine Layer**: If they need assembly, our reasoning engine decomposes the request, runs it through a three-stage retrieval pipeline — bi-encoder for semantic search, cross-encoder for re-ranking, rapidfuzz for fuzzy matching — and uses a region-aware Groq LLM to optimize. Out-of-stock items trigger alternative suggestions, but the user always decides.

**⑤ Storage Layer**: Shared stores — DynamoDB for products, users, and orders; Redis for cart state and caching.

**⑥ Cart Layer**: We present one confident cart with the best pick, economical alternatives, verified badges, and confidence scores with reasoning.

**⑦ Checkout Layer**: User places the order, selects payment, and we confirm and persist to storage.

Dotted lines show optional paths — refining the cart loops back to the engine, and order history feeds subscription patterns."

---

## Key Implementation Details in This Hybrid Diagram

- **Layer 1**: Shows actual use cases (not just feature names)
- **Layer 2**: Reveals security mechanisms (SSRF, rate limiting) and capture technologies
- **Layer 4**: Breaks down the retrieval pipeline (bi-encoder → cross-encoder → fuzzy) and LLM reasoning
- **Layer 5**: Specifies storage technology and what each stores
- **Flows**: Main paths are solid, optional refinement/OOS paths are dotted
- **Clean separation**: Each layer has a clear responsibility without cluttering the visual space class Decision decide;
    class Buyer,Seller actor;