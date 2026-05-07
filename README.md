# 🧠 Axiom — AI Representation Layer for Shopify

<div align="center">

**🏆 Built for the Kasparro Agentic Commerce Hackathon — Track 5: AI Readiness & Store Optimization**

*The first Shopify app that audits, scores, and auto-fixes your store for AI-driven product discovery.*

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Polaris](https://img.shields.io/badge/Shopify%20Polaris-13.x-96BF48?logo=shopify&logoColor=white)](https://polaris.shopify.com)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> **Live Demo:** [axiom-tp2a.onrender.com](https://axiom-tp2a.onrender.com)

</div>

---

## 📌 Project Overview

**Axiom** is a production-grade, full-stack Shopify embedded application built to solve a problem that didn't exist five years ago — but will define the next decade of e-commerce: **Generative Engine Optimization (GEO)**.

Traditional SEO optimizes for search engine crawlers. GEO optimizes for AI assistants — ChatGPT, Gemini, Perplexity, and Copilot — that are rapidly replacing Google as the primary interface for product discovery. When a customer asks an AI *"What's the best snowboard for beginners?"*, the AI doesn't rank your meta tags. It reads your content, extracts facts, evaluates trust signals, and decides whether to recommend your product or your competitor's.

**Most Shopify merchants have zero visibility into how AI perceives their store. Axiom fixes that.**

The platform ingests an entire Shopify store — products, collections, blogs, policies, discounts, and metadata — runs it through a dual-model AI pipeline (Gemini 2.5 Flash + Gemma 4 31B), produces a forensic GEO Health Score, and delivers a one-click fix engine that writes corrections directly back to the Shopify Admin API.

---

## ❗ Problem Statement

Traditional SEO optimizes for search engine crawlers. But the commerce landscape is shifting — **40% of Gen Z now uses AI chatbots instead of Google** for product discovery (Google Internal Data, 2024). When a customer asks ChatGPT *"What's the best waterproof jacket under ₹5000?"*, the AI doesn't crawl your meta tags. It evaluates:

- **Can it extract a clear, quotable answer?** ("The Axiom Pro is ideal for beginners because...")
- **Does the content contain verifiable statistics?** (dimensions, ratings, comparisons)
- **Are trust signals present?** (reviews, policies, certifications)
- **Is the data structured for machine consumption?** (clean HTML, FAQ blocks, structured attributes)

Most Shopify merchants have **zero visibility into how AI perceives their store**. They're optimizing for a world that no longer exists — and losing sales to competitors whose content happens to be more AI-readable.

### The Gap: Without GEO vs. With Axiom

| Without GEO | With Axiom |
|---|---|
| AI skips your products entirely | AI cites your products in top-3 recommendations |
| Generic descriptions with no stats | Data-rich, quotable product copy |
| Missing policies erode trust signals | Complete policy coverage detected & fixed |
| No FAQ content for AI extraction | Structured Q&A blocks AI can cite verbatim |
| Blind to how AI "sees" your store | Full diagnostic dashboard with layer-by-layer scoring |
| Descriptions that are "marketing fluff" | Evidence-backed, justification-rich content |

## 💡 Solution & Product Thinking

### Who Is This For?

Axiom targets **non-technical Shopify store owners** who:
- Don't know what GEO is, but are losing sales to AI-driven discovery
- Can't afford an SEO agency but need actionable, specific fixes
- Want one-click solutions, not a checklist of technical jargon
- Run stores with 10–500 products and want to stay competitive as AI reshapes commerce

### Core Design Principles

1. **Zero-Jargon UI**: Every issue, score, and recommendation is written in plain language. No "JSON-LD", "canonical URLs", or "meta tags" — just *"Your product info isn't set up for AI assistants."*
2. **Fix, Don't Just Report**: Every diagnostic finding comes with a concrete, editable, one-click fix that writes directly to the Shopify Admin API via GraphQL mutations.
3. **AI Audits AI**: We use AI (Gemini + Gemma) to audit how other AIs will perceive your store — fighting fire with fire with deterministic constraints.
4. **Deductive Scoring (Anti-Hallucination)**: Scores start at 100 and deduct only for verified issues. This prevents score inflation and ensures scores never drop after fixes are applied.
5. **Server-Side Integrity**: The audit always fetches store data server-side using admin tokens — a merchant can never send fabricated data to manipulate their own GEO score.

---

## 🚀 Platform Features

| # | Feature | Core Capability | AI Model | Key Outputs |
|---|---|---|---|---|
| 1 | **Store GEO Audit** | Full-store AI readiness analysis | Gemini 2.5 Flash | 0–100 Health Score, 6 layer scores, executive summary, priority action plan |
| 2 | **Product Deep Analysis** | Per-product 15-test diagnostic | Gemma 4 31B (Multimodal) | SEO/GEO/Content/Image scores, issues, one-click fixes |
| 3 | **Blog Intelligence** | Per-article 12-test diagnostic + AI generation | Gemma 4 31B | Readability/SEO/GEO scores, rewrite suggestions, full article generation |
| 4 | **One-Click Fix Engine** | GraphQL mutation applicator | Deterministic | Applies product, page, policy, blog fixes directly to Shopify Admin |

### Feature 1 — Store-Level GEO Audit (Gemini 3 Flash)
- Ingests **entire store data**: up to 50 products, all collections, pages, policies, blogs, discounts, redirects, and store metadata
- Produces a **0–100 GEO Health Score** across 6 weighted scoring layers
- Generates a **severity-ranked action plan** (CRITICAL / HIGH / MEDIUM / LOW) with machine-applicable fixes
- Provides an **executive summary** highlighting the top threat and top opportunity
- Internally generates a **Store Context Synthesis** — a 400-word brand identity profile saved server-side to power all subsequent product analyses

### Feature 2 — Product Deep-Dive Analysis (Gemma 4 31B — Multimodal)
- Runs **15 diagnostic tests** per product across SEO, GEO, Content, and Image categories
- **Multimodal**: fetches and analyzes up to 3 actual product images alongside the text description
- **Cross-validates** descriptions against images (e.g., *"description claims 5 colors but images show only 1"*)
- **Cross-references** product claims against the saved store context baseline for compliance
- Returns scored analysis with `overallScore`, `riskLevel`, and concrete, API-ready `fixes[]`

### Feature 3 — Blog Intelligence Engine (Gemma 4 31B)
- Runs **12 diagnostic tests** per article across SEO, Readability, and GEO categories
- AI-powered blog **generation** with GEO-optimized structure: ≥5 statistics, ≥3 justification fragments, FAQ sections
- One-click **publish to Shopify** via REST API with blog selector
- Existing article analysis with specific, field-level rewrite suggestions

### Feature 4 — One-Click Fix Engine
- Every AI finding includes a machine-applicable fix with exact `oldValue` → `newValue` pairs
- **Editable preview modal** before applying — merchants can tweak AI suggestions
- **Intelligent GID resolution**: handles → GIDs, titles → GIDs, numeric IDs → GIDs (3-strategy fallback)
- **Fallback logic**: if a page update fails (page doesn't exist), auto-creates it
- **Fix registry**: tracks applied fixes in-session to prevent duplicate re-suggestions

---

## 🏗️ System Architecture

Axiom is a decoupled, three-tier system with a strict boundary between its AI reasoning layer and its deterministic data/mutation layer:

```
+------------------------------------------------+
|       Shopify Admin (Browser / iframe)          |
|                                                 |
|  +-------------------------------------------+  |
|  |    React + Polaris Frontend  (Vite 8)      | |
|  |                                            | |
|  |  LoginView -> ExtractingView -> AppShell   | |
|  |                     |                      | |
|  |  +----------+----------+----------+------+ | |
|  |  | Overview | Actions  | Products | Blogs| | |
|  |  | GEO gauge| act.plan | 15 tests | AIgen| | |
|  |  +----------+----------+----------+------+ | |
|  |      DashboardContext  (shared state)      | |
|  +--------------------+----------------------+  |
+-----------------------------|-------------------+
                              | HTTPS + JSON
+-----------------------------|-------------------+
|   Express 5 Backend  (Node.js ESM, Port 3000)   |
|                                                 |
|   Route handlers:                               |
|   /api/auth    /api/shopify    /api/audit       |
|   /api/fix     /api/blog                        |
|                                                 |
|   Services: ai/gemini | ai/gemma                |
|             shopify/rest | shopify/data         |
|   In-memory: tokenStore | policyStore           |
+--------------------+----------------------------+
         |                        |
         v                        v
+--------------------+   +---------------------------+
| Shopify Admin API  |   |  Google AI Platform        |
|                    |   |                            |
| GraphQL 2024-10:   |   | gemini-3-flash-preview:    |
|  - Products (50)   |   |   Store-level GEO audit    |
|  - Collections     |   |   1M token context window  |
|  - Pages           |   |                            |
|  - Blogs/Articles  |   | gemma-4-31b-it:            |
|  - Mutations       |   |   Product 15-test AI       |
|                    |   |   Blog analysis/generation |
| REST 2023-10:      |   |   Multimodal (img + text)  |
|  - Policies        |   +---------------------------+
|  - Discounts       |
|  - Redirects       |
+--------------------+
```

**Traffic Flow:**
- **ngrok** tunnels `https://<id>.ngrok-free.app` → `localhost:3000` (Express) during local development
- Express serves the Vite production build at `/` and proxies non-API requests to `localhost:5173` in dev mode
- Shopify OAuth callbacks hit `localhost:3000/api/auth/callback`
- All AI calls go directly from the Node.js backend — the React frontend never calls Google AI APIs directly

### AI / Deterministic Boundary

The most critical architectural decision in Axiom. Every operation is classified into exactly one of two layers:

| Layer | Operations | Rationale |
|---|---|---|
| **Deterministic** | Data extraction, GID resolution, fix application, score math | Correctness required; zero variance acceptable |
| **AI Reasoning** | Issue identification, fix content generation, image evaluation, blog generation | Judgment required; rules cannot substitute |

Mixing these layers causes instability. Axiom keeps them strictly separate.

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI component framework |
| TypeScript | ~6.0 | Type-safe development |
| Vite | 8.x | Build tool & dev server (Port 5173) |
| Shopify Polaris | 13.9.x | Native Shopify Admin design system |
| TailwindCSS | 4.x | Utility-first layout & custom styling |
| Lucide React | 1.8.x | Consistent icon library |
| @uiw/react-json-view | 2.x | Structured JSON data display |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Server runtime (ESM modules) |
| Express | 5.x | HTTP framework & API router |
| http-proxy-middleware | 3.x | Proxy non-API requests to Vite in dev |
| cors | 2.x | Cross-origin request handling |
| dotenv | 17.x | Environment variable management |
| concurrently | 9.x | Run backend + frontend in one command |

### AI Models

| Model | Provider | Role | Temperature |
|---|---|---|---|
| `gemini-3-flash-preview` | Google AI | Store-level GEO audit (primary) | 0.1 |
| `gemini-2.5-flash` | Google AI | Store audit fallback | 0.1 |
| `gemma-4-31b-it` | Google AI | Product analysis, blog analysis, blog generation | 0.1 / 0.7 |

### Shopify API

| API | Version | Used For |
|---|---|---|
| Admin GraphQL | 2024-10 | Products, collections, pages, mutations |
| Admin REST | 2023-10 | Policies, discounts, blogs, redirects |
| OAuth 2.0 | — | Merchant authentication & token management |

---

## 📂 Complete File Structure

```text
Axiom/
│
├── backend/                          # Node.js Express API Server
│   ├── routes/                       # Route handlers (mounted at /api/*)
│   │   ├── auth.js                   # OAuth 2.0 install, callback, session routes
│   │   ├── ai-audit.js               # GEO store audit + product analysis endpoints
│   │   ├── fix.js                    # GraphQL mutation engine + GID resolver (17KB)
│   │   ├── blog.js                   # Blog analysis, generation, and publish pipeline
│   │   └── shopify-proxy.js          # Secure passthrough proxy to Shopify Admin API
│   │
│   ├── services/                     # Business logic & external integrations
│   │   ├── ai/
│   │   │   ├── gemini.js             # Store audit — Gemini Flash, 10 GEO principles
│   │   │   └── gemma.js              # Product (15 tests) + Blog (12 tests) analysis
│   │   └── shopify/
│   │       ├── rest.js               # HTTPS client, token refresh, REST helper
│   │       └── data.js               # Secure store data fetcher (GraphQL + REST)
│   │
│   ├── server.js                     # Express entry point — Port 3000
│   └── store.js                      # In-memory tokenStore & policyStore
│
├── src/                              # React Frontend (Vite + TypeScript)
│   ├── api/
│   │   └── fixClient.ts              # Fix mutation API client
│   │
│   ├── assets/                       # Static images & icons
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   └── LoginView.tsx         # Standalone OAuth install page
│   │   ├── extraction/
│   │   │   └── ExtractingView.tsx    # Store data loading spinner state
│   │   └── dashboard/
│   │       ├── AppShell.tsx          # Tab navigation shell + hash-based SPA routing
│   │       ├── DashboardContext.tsx  # Shared dashboard state provider
│   │       ├── pages/
│   │       │   ├── OverviewPage.tsx  # GEO health gauge + 6 layer score bars
│   │       │   ├── ActionsPage.tsx   # Severity-sorted priority action plan
│   │       │   ├── ProductsPage.tsx  # Per-product deep analysis list
│   │       │   └── BlogsPage.tsx     # Blog analysis + AI generation + publish
│   │       └── components/
│   │           ├── HealthGauge.tsx       # Animated SVG radial GEO score gauge
│   │           ├── ActionItemCard.tsx    # Severity-tagged issue card with fix button
│   │           ├── FixPreviewModal.tsx   # Editable diff view + apply fix button
│   │           └── ProductRow.tsx        # Expandable product analysis row
│   │
│   ├── lib/
│   │   └── shopify.ts                # Frontend Shopify data fetcher (GraphQL + REST)
│   │
│   ├── utils/
│   │   ├── authGuard.ts              # 401 auto-recovery + session management
│   │   ├── friendlyError.ts          # User-friendly error message mapping
│   │   └── aiFixRegistry.ts          # Tracks applied fixes to prevent re-suggestion
│   │
│   ├── App.tsx                       # Root component: embedded detection, OAuth, routing
│   ├── main.tsx                      # Polaris AppProvider + Vite entry point
│   ├── index.css                     # Global styles + Tailwind directives
│   └── App.css                       # App-level overrides
│
├── public/                           # Static assets served by Vite
├── .env.local                        # Local environment variables (DO NOT COMMIT)
├── .gitignore
├── index.html                        # Vite HTML entry point
├── package.json                      # NPM scripts & dependencies
├── vite.config.ts                    # Vite bundler configuration
├── tsconfig.json                     # TypeScript root config
├── tsconfig.app.json
├── tsconfig.node.json
├── ecosystem.config.cjs              # PM2 production process manager config
├── technical_document.md             # Full technical deep-dive documentation
└── product_document.md               # Product pitch and value proposition doc
```

---

## 📖 The 10 GEO Principles (Research-Backed)

Axiom's entire audit framework is built on 10 GEO principles distilled from academic research on how generative AI engines select, rank, and cite e-commerce content. Every scoring layer, every diagnostic test, and every fix template traces back to one of these principles.

| # | Principle | What It Means | How Axiom Tests It |
|---|---|---|---|
| 1 | **Third-Party Authority** | AI favors earned media (reviews, expert mentions) over brand-owned content | Checks for review signals, expert quotes, certification references |
| 2 | **AI Answer Visibility** | Success = appearing *inside* the AI's response, not just being indexed | Evaluates if content is "citation-ready" with quotable, standalone statements |
| 3 | **Justifiability** | AI is a decision engine — content must explain *why* | Counts "ideal for", "best for", "recommended because" fragments (min 3/product) |
| 4 | **Structured Data** | Treat your store as an API for AI | Audits JSON-LD completeness, FAQ markup, product schema richness |
| 5 | **High-Impact Strategies** | Stats (+30-40%), Citations (+30-40%), Quotes (+25-35%), Fluency (+15-30%) | Measures statistics density (min 5/product), citation readiness, prose quality |
| 6 | **Engine-Specific Optimization** | GPT wants authority, Gemini wants structure, Perplexity wants citations | Cross-engine scoring layer evaluates optimization for each AI platform |
| 7 | **Full Purchase Journey** | Content must cover Awareness → Consideration → Decision → Post-purchase | Checks for guides, comparison pages, pricing transparency, care instructions |
| 8 | **GEO Defense** | Build a moat of high-authority content to prevent competitor displacement | Identifies content gaps competitors could exploit |
| 9 | **The Equalizer** | GEO offers +115% boost for lower-ranked sites — quality beats brand size | Prioritizes high-impact, low-effort fixes for smaller stores |
| 10 | **AI Readability** | Semantic clarity and extraction readiness over keyword density | Tests scannability, Q&A format, standalone factual statements |

> **Research Foundation**: These principles are derived from the paper *"GEO: Generative Engine Optimization"* (Aggarwal et al., 2023) and subsequent industry analyses on AI-driven product discovery.

### Six GEO Scoring Layers

| Layer | Weight | What Is Scored |
|---|---|---|
| **Schema & Structured Data** | /20 pts | JSON-LD completeness, product schema, FAQ markup |
| **Content Quality** | /20 pts | Description depth, statistics density, justification fragments |
| **Trust Signals** | /15 pts | Reviews, certifications, policy coverage, return info |
| **Extractability** | /15 pts | Citation-readiness, quotable statements, AI scannability |
| **Journey & Policy** | /20 pts | Purchase journey coverage, policy pages, comparison content |
| **Cross-Engine Visibility** | /10 pts | Optimization for GPT, Gemini, Perplexity, Copilot |

**Deduction Scale:** CRITICAL → −20 pts · HIGH → −10 pts · MEDIUM → −5 pts · LOW → −2 pts

---

## 🤖 AI Pipeline: Dual-Model Strategy

### Why Two Models?

| Aspect | Gemini 2.5 Flash (Store Audit) | Gemma 4 31B IT (Product & Blog) |
|---|---|---|
| **Purpose** | Holistic store-level GEO audit | Granular per-product / per-article analysis |
| **Input Size** | ~50 products + policies + blogs (~5K–200K tokens) | Single product + images (~2K–5K tokens) |
| **Modality** | Text-only | **Multimodal** (text + product images) |
| **Output** | 6 layer scores + category scores + action plan | 4 category scores + 15 test results + fixes |
| **Temperature** | 0.1 (deterministic, consistent scoring) | 0.1 (analysis) / 0.7 (blog generation) |
| **Why This Model** | Large context window, fast, structured JSON output | Best open-weight model for image+text structured analysis |

### 2-Layer API Fallback Chain

```
Request
  │
  ├─► Primary API Key + gemini-3-flash-preview
  │     └─ 429 / 503 / 404 / overloaded → continue
  │
  ├─► Primary API Key + gemini-2.5-flash
  │     └─ 429 / 503 / 404 → continue
  │
  ├─► Fallback API Key + gemini-3-flash-preview
  │     └─ still failing → continue
  │
  └─► Fallback API Key + gemini-2.5-flash
        └─ all fail → graceful error to user
```

For **Gemma** (product / blog), additional per-key exponential backoff:
- **3 attempts per key** with `1500ms × attempt` delay
- Blocks `SAFETY` / `RECITATION` finish reasons
- Ensures `overallScore` exists before accepting response
- Neutral score (50) returned on full exhaustion — no crash

---

## 🔬 Deep Dive: GEO Audit Engine

### Store Audit Data Flow

```
Frontend: POST /api/audit/store  { headers: x-shopify-domain, x-shopify-token }
       │
       ▼  getValidToken() — authenticate request
       │
       ├─ GraphQL 2024-10 (parallel fetches):
       │  ├─ 50 products (title, desc, images, variants, tags)
       │  ├─ Collections (title, description, product count)
       │  ├─ Pages (body text)
       │  └─ Blogs + Articles (title, body, tags, author)
       │
       ├─ REST 2023-10 (parallel fetches):
       │  ├─ Policies (refund, privacy, shipping, TOS)
       │  ├─ Discounts / price rules
       │  ├─ Customers & orders count
       │  └─ URL Redirects
       │
       ▼  fetchInternalStoreData() — transform + normalize
       │
       │  JSON payload (~200k tokens max) → Gemini 3-flash-preview
       │  [On 429 / 503 / 404 → 4-step fallback chain activates]
       │
       ▼  Structured JSON audit returned from Gemini
       │
       ├─ policyStore.set(shop, { storeContextSynthesis })
       ├─ Strip synthesis from response before sending to frontend
       │
       ▼  GEO audit JSON → OverviewPage + ActionsPage rendered
```

### Store Context Synthesis — The Coherence Layer

After every store audit, Gemini generates a ~400-word internal brand profile:
- Store identity + target demographic
- Product categories + price positioning
- Core policies (shipping, returns, refunds)
- Value propositions + brand voice markers

This synthesis is **saved server-side only** (never sent to the frontend) in `policyStore`. It is injected as ground truth context into every subsequent per-product and blog analysis, ensuring Gemma's output is brand-consistent — not generic.

> **Why hidden from frontend?** If merchants can read the synthesis, they craft descriptions to match it — gaming the GEO score rather than genuinely improving AI readiness. It is an internal evaluation tool, not a merchant deliverable.

### Per-Product Analysis — 15 Diagnostic Tests

Gemma 4 31B runs 15 enumerated, specific tests across 4 categories per product:

| Category | Tests | Key Thresholds |
|---|---|---|
| **SEO (T1–T4)** | Title structure, snippet readiness, keyword density, URL slug quality | — |
| **GEO (T5–T8)** | Statistics density, justification fragments, citation readiness, comparison anchors | ≥5 stats, ≥3 justification phrases |
| **Content (T9–T12)** | Description depth & word count, image↔description cross-validation, policy compliance, tag quality | — |
| **Image (T13–T15)** | Count & diversity, alt text audit, visual quality assessment (actual multimodal image analysis) | — |

Each test returns a `pass/fail`, severity level, issue description, and a machine-applicable `fix` object with exact `oldValue`/`newValue`.

---

## 🔧 Deep Dive: One-Click Fix Engine

### End-to-End Fix Pipeline

```
AI Audit Output:
  diagnosticsAndActionPlan[category][n].fixes[]
  Each fix: { type, resourceId, field, oldValue, newValue, label }
       │
       ▼  "Preview & Fix" button clicked in ActionsPage or ProductsPage
       │
  FixPreviewModal opens:
  ┌────────────────────────────────────────────────┐
  │  Current value  (red background — read-only)   │
  │              ↓ proposed change                 │
  │  Proposed value (green — EDITABLE textarea)    │
  └────────────────────────────────────────────────┘
       │  Merchant reviews, optionally edits, clicks [Apply Fix]
       │
       │  POST /api/fix/apply
       │  Body: { type, resourceId, newValue, resourceTitle }
       ▼
  fix.js — GID Resolution (3-strategy fallback)
  ┌──────────────────────────────────────────────────┐
  │  AI provides: "gid://shopify/Product/the-board"  │
  │  (handle in GID position — common AI error)      │
  │                                                  │
  │  Strategy 1: GraphQL handle search               │
  │    { products(query: "handle:the-board") { id } }│
  │               │ not found? ↓                     │
  │  Strategy 2: Title search                        │
  │    { products(query: "title:The Board") { id } } │
  │               │ not found? ↓                     │
  │  Strategy 3: Kebab-case conversion + retry       │
  │    theBoard → the-board → handle search again    │
  │               │                                  │
  │  Resolved: gid://shopify/Product/8234567890      │
  └──────────────────────────────────────────────────┘
       │
       ▼  GraphQL / REST Mutation applied to Shopify Admin API
       │
       ▼  registerAIFix(resourceId, field, label)
          Fix added to session registry — never suggested again
          refreshData() called silently in background
```

### Supported Fix Types

| Fix Type | Shopify Operation | Target Resource |
|---|---|---|
| `product_title` | `productUpdate` | Product title field |
| `product_description` | `productUpdate` | `descriptionHtml` field |
| `product_tags` | `productUpdate` | Tags array |
| `product_metafield` | `metafieldsSet` | Custom namespace + key |
| `page_content` | `pageUpdate` → fallback `pageCreate` | Page body HTML |
| `page_title` | `pageUpdate` | Page title |
| `collection_description` | `collectionUpdate` | `descriptionHtml` |
| `shop_policy` | `shopPolicyUpdate` | REFUND / PRIVACY / SHIPPING / TOS |
| `article_title` | `articleUpdate` | Blog article title |
| `article_body` | `articleUpdate` | Blog article body HTML |
| `article_tags` | `articleUpdate` | Blog article tags array |

### Fix Registry — Session Deduplication

```typescript
// aiFixRegistry.ts — module-level Map, persists across all renders
registerAIFix(resourceId, field, label):
  key = `${resourceId}::${field}::${label}`
  registry.set(key, true)

filterAlreadyFixed(fixes[]):
  return fixes.filter(f =>
    !registry.has(`${f.resourceId}::${f.field}::${f.label}`)
  )
```

Once a fix is applied, that exact `(resource + field + label)` combination is permanently excluded from the UI in the current session — preventing duplicate re-suggestions after partial application.

---

## 📝 Deep Dive: Blog Intelligence Engine

### Blog Analysis — 12 Diagnostic Tests (Gemma 4 31B)

| Category | Tests |
|---|---|
| **SEO (T1–T4)** | Title optimization, heading structure (H2/H3), keyword strategy, snippet readiness |
| **Readability (T5–T8)** | Paragraph length, sentence complexity, scannability (lists/headers), word count |
| **GEO (T9–T12)** | Statistics density (≥5), justification fragments (≥3), E-E-A-T signals, FAQ readiness |

Injected with `policyStore` context for brand-aligned analysis. Returns `seoScore`, `readabilityScore`, `geoScore`, `overallScore`, `issues[]`, and `fixes[]`.

### Blog Generation + Publish Flow

```
Merchant enters topic
       │  POST /api/blog/generate  { topic, blogId }
       ▼
  runBlogGeneration(shop, topic)
  └─ Inject policyStore context (brand voice, policies)
  └─ temperature: 0.7  (creative mode — varied output)
  └─ Gemma 4 31B generates:
       {
         title, bodyHtml, tags[], metaDescription, summary
       }

  bodyHtml is GEO-structured and includes:
  ├─ <h2>/<h3> heading hierarchy
  ├─ ≥5 quantitative statistics with sources
  ├─ ≥3 justification fragments ("best for", "ideal when")
  ├─ FAQ section with 3–5 Q&A pairs (AI-extractable)
  ├─ Short paragraphs + bullet-point lists
  └─ Natural product/brand references

  If blogId provided:
       │  POST /admin/api/2024-10/blogs/{blogId}/articles.json
       ▼  Article published: true → Shopify
          Shopify article ID returned to frontend for confirmation
```

---

### Security Measures

| Measure | Implementation |
|---|---|
| **HMAC validation** | Every OAuth callback verified with `crypto.timingSafeEqual` (prevents timing attacks) |
| **Server-side token storage** | Tokens stored in in-memory `Map` — never exposed to frontend |
| **Data forgery prevention** | Audit fetches store data server-side; client-supplied body is explicitly ignored |
| **401 auto-recovery** | `authGuard.ts` detects expired sessions, wipes stale state, triggers re-authentication |
| **CSP headers** | `frame-ancestors` restricted to `*.myshopify.com` and `admin.shopify.com` |
| **Score integrity** | Audit endpoint never trusts client payloads — always re-fetches directly from Shopify |

### Requested API Scopes

```
read_products        write_products       read_content         write_content
read_customers       read_orders          read_inventory       write_inventory
read_discounts       write_discounts      read_themes          write_theme_code
read_legal_policies  write_legal_policies read_files           write_files
read_translations    write_translations   read_locales         write_locales
```

---

## 🏪 Creating the Shopify App & Permissions

### Step 1 — Create the App

1. Log in to your [Shopify Partner Dashboard](https://partners.shopify.com/).
2. Go to **Apps** → **All apps** → **Create app**.
3. Select **Create app manually**.
4. Name the app **Axiom** and confirm.

### Step 2 — Configure API Scopes

In **App Settings** → **Configuration** → **Admin API integration**, request the full scope list above.

### Step 3 — Get Credentials

Navigate to **Client credentials** and copy:
- **Client ID** → maps to `SHOPIFY_CLIENT_ID` and `VITE_SHOPIFY_API_KEY`
- **Client secret** → maps to `SHOPIFY_CLIENT_SECRET`

### Step 4 — Create a Development Store

1. In Partner Dashboard → **Stores** → **Add store**.
2. Select **Development store**, fill in details, and create it.
3. This is the store you will install Axiom on for testing.

### Step 5 — Configure App URLs (ngrok for local dev)

Start ngrok on port 3000:
```bash
ngrok http 3000
```

In Shopify Partner Dashboard → App → **Configuration**:

| Field | Value |
|---|---|
| **App URL** | `https://abcd1234.ngrok-free.app` |
| **Allowed redirection URL(s)** | `https://abcd1234.ngrok-free.app/api/auth/callback` |

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the **root** of the project. This file is gitignored and must never be committed.

```env
# ─── Shopify App Credentials ────────────────────────────
SHOPIFY_CLIENT_ID=your_client_id_from_partner_dashboard
SHOPIFY_CLIENT_SECRET=your_client_secret_from_partner_dashboard

# ─── App URL (ngrok for local / Render URL for prod) ────
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok-free.app

# ─── Google AI ──────────────────────────────────────────
GEMINI_API_KEY=your_primary_google_ai_studio_key
GEMINI_API_KEY_FALLBACK=your_secondary_google_ai_studio_key

# ─── Vite (App Bridge needs the public API key) ─────────
VITE_SHOPIFY_API_KEY=your_client_id_from_partner_dashboard

# ─── Runtime ────────────────────────────────────────────
NODE_ENV=development
```

| Variable | Where to Get It | Required |
|---|---|---|
| `SHOPIFY_CLIENT_ID` | Shopify Partner Dashboard → App → Client credentials | ✅ Yes |
| `SHOPIFY_CLIENT_SECRET` | Shopify Partner Dashboard → App → Client credentials | ✅ Yes |
| `SHOPIFY_APP_URL` | Active ngrok HTTPS URL (dev) or Render URL (prod) | ✅ Yes |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) | ✅ Yes |
| `GEMINI_API_KEY_FALLBACK` | Google AI Studio (second key for the 4-step fallback chain) | ⚠️ Recommended |
| `VITE_SHOPIFY_API_KEY` | Same value as `SHOPIFY_CLIENT_ID` | ✅ Yes |

---

## 💻 Running the Application

### Prerequisites

| Requirement | Minimum Version |
|---|---|
| Node.js | 20+ |
| npm | 9+ |
| Google Chrome | Latest stable |
| ngrok | Free account |
| Shopify Partner Account | — |

### Step 1 — Clone & Install

```bash
git clone https://github.com/omkar-prabhu-github/shopify.git
cd shopify
npm install --legacy-peer-deps
```

### Step 2 — Configure Environment

Copy and fill in `.env.local` as described in the [Environment Configuration](#-environment-configuration) section above.

### Step 3 — Start ngrok

```bash
ngrok http 3000
```

Update `SHOPIFY_APP_URL` in `.env.local` and in the Shopify Partner Dashboard App Configuration with the new HTTPS URL.

### Step 4 — Start the Servers

The `npm start` command uses `concurrently` to launch both the Express backend and Vite dev server simultaneously:

```bash
npm start
```

Expected terminal output:
```
✅ Backend running at http://localhost:3000
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Individual commands if needed:
```bash
npm run proxy   # Express backend only (port 3000)
npm run dev     # Vite frontend only (port 5173)
```

### Step 5 — Install the App on Your Dev Store

1. Navigate to: `https://your-ngrok-url.ngrok-free.app/install`
2. Enter your development store's `.myshopify.com` name.
3. Complete the OAuth flow — you will be redirected into the Shopify Admin.
4. The Axiom dashboard loads inside the Shopify Admin iframe.

---

## 🚀 Production Deployment (Render)

1. Connect your GitHub repo to [Render](https://render.com/).
2. **Build Command**: `npm install --legacy-peer-deps --include=dev && npm run build`
3. **Start Command**: `node backend/server.js`
4. Set all environment variables in the Render dashboard.
5. In Shopify Partner Dashboard → App → Configuration:
   - **App URL**: `https://axiom-dev.tech`
   - **Allowed redirection URL**: `https://axiom-dev.tech/api/auth/callback`

The `ecosystem.config.cjs` in the root provides a PM2 configuration for self-hosting on a VPS.

---

*Built for the **Kasparro Agentic Commerce Hackathon** · Track 5 (Advanced) · April 2026.*
