# Axiom — AI-Powered GEO Analyst for Shopify

**Axiom** is a production-grade Shopify embedded app that audits, scores, and automatically fixes a merchant's store for **Generative Engine Optimization (GEO)** — the emerging discipline of optimizing e-commerce content so AI assistants (ChatGPT, Gemini, Perplexity, Copilot) recommend your products over competitors.

> **Live Demo:** [https://axiom-tp2a.onrender.com](https://axiom-tp2a.onrender.com)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution & Product Thinking](#solution--product-thinking)
3. [Key Features](#key-features)
4. [Architecture & Technical Design](#architecture--technical-design)
5. [The 10 GEO Principles (Research-Backed)](#the-10-geo-principles-research-backed)
6. [AI Pipeline: Dual-Model Strategy](#ai-pipeline-dual-model-strategy)
7. [Advanced System Prompt Engineering](#advanced-system-prompt-engineering)
8. [Security & Authentication](#security--authentication)
9. [Tech Stack](#tech-stack)
10. [Setup & Installation](#setup--installation)
11. [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)
12. [Decision Log](#decision-log)

---

## Problem Statement

Traditional SEO optimizes for search engine crawlers. But the commerce landscape is shifting — **40% of Gen Z now uses TikTok and AI chatbots instead of Google** for product discovery (Google Internal Data, 2024). When a customer asks ChatGPT *"What's the best snowboard for beginners?"*, the AI doesn't crawl your meta tags. It evaluates:

- **Can it extract a clear, quotable answer?** ("The Axiom Pro is ideal for beginners because...")
- **Does the content contain verifiable statistics?** (dimensions, ratings, comparisons)
- **Are trust signals present?** (reviews, policies, certifications)
- **Is the data structured for machine consumption?** (JSON-LD, clean HTML, FAQ blocks)

Most Shopify merchants have **zero visibility into how AI perceives their store**. Axiom solves this by giving merchants an AI-readability score, pinpointing exactly what's broken, and auto-fixing it with one click.

### Why This Matters for Merchants

| Without GEO | With Axiom |
|---|---|
| AI skips your products entirely | AI cites your products in top-3 recommendations |
| Generic descriptions with no stats | Data-rich, quotable product copy |
| Missing policies erode trust signals | Complete policy coverage detected & fixed |
| No FAQ content for AI extraction | Structured Q&A blocks AI can cite verbatim |
| Blind to how AI "sees" your store | Full diagnostic dashboard with layer-by-layer scoring |

---

## Solution & Product Thinking

### Who is this for?

Axiom targets **non-technical Shopify store owners** who:
- Don't know what GEO is, but are losing sales to AI-driven discovery
- Can't afford an SEO agency but need actionable, specific fixes
- Want one-click solutions, not a checklist of technical jargon

### Core Design Principles

1. **Zero-Jargon UI**: Every issue, score, and recommendation is written in plain language. No "JSON-LD", "canonical URLs", or "meta tags" — just "Your product info isn't set up for AI assistants."
2. **Fix, Don't Just Report**: Every diagnostic finding comes with a concrete, editable, one-click fix that writes directly to the Shopify Admin API.
3. **AI Audits AI**: We use AI (Gemini + Gemma) to audit how other AIs will perceive your store — fighting fire with fire.
4. **Deductive Scoring (Anti-Hallucination)**: Scores start at 100 and deduct for verified issues. This prevents score inflation and ensures scores never drop after fixes are applied.

### What We Built vs. What We Didn't

| Built (In Scope) | Intentionally Excluded |
|---|---|
| Full OAuth 2.0 with token rotation | Shopify App Bridge deep-linking |
| GEO store audit (6 scoring layers) | Real-time webhook listeners |
| Per-product deep analysis (15 tests) | Multi-language support |
| Blog analysis + AI generation | Theme code editing |
| One-click mutation fixes via GraphQL | Billing / subscription management |
| Multimodal image analysis | Customer-facing storefront widget |

We scoped aggressively to deliver depth over breadth — a forensic audit engine, not a shallow dashboard.

---

## Key Features

### 1. Store-Level GEO Audit (Gemini Flash)
- Ingests entire store data: products, collections, policies, pages, blogs, discounts, redirects
- Produces a **0-100 GEO Health Score** across 6 weighted layers
- Generates a severity-ranked action plan with one-click fixes
- Executive summary with top threat + top opportunity

### 2. Product Deep-Dive Analysis (Gemma 4 31B — Multimodal)
- **15 diagnostic tests** per product across SEO, GEO, Content, and Image categories
- **Multimodal**: fetches and analyzes actual product images (up to 3) alongside text
- Cross-validates descriptions against images (e.g., "description says 5 colors but images show 1")
- Cross-references product claims against store policies for compliance

### 3. Blog Intelligence Engine (Gemma 4 31B)
- **12 diagnostic tests** per article (SEO, Readability, GEO)
- AI-powered blog **generation** with GEO-optimized structure (stats, justification fragments, FAQ sections)
- One-click **publish to Shopify** via REST API
- Existing article analysis with concrete rewrite suggestions

### 4. One-Click Fix Engine
- Every AI finding includes a machine-applicable fix with exact `oldValue` → `newValue`
- Editable preview modal before applying
- Supports: product titles, descriptions, tags, metafields, page content, collection descriptions, blog articles, and store policies
- Intelligent ID resolution: handles → GIDs, titles → GIDs, numeric IDs → GIDs
- Fallback logic: if a page update fails (page doesn't exist), auto-creates it

### 5. Polaris-Native Embedded UI
- Built entirely with **Shopify Polaris v13** components
- Renders natively inside the Shopify Admin iframe
- Tab-based navigation: Overview, Actions, Products, Blogs
- Interactive GEO layer score bars with expandable AI reasoning
- Animated health gauge, staggered card animations

---

## Architecture & Technical Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Shopify Admin (iframe)                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              React + Polaris Frontend                    │ │
│  │  OverviewPage │ ActionsPage │ ProductsPage │ BlogsPage  │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │ Relative API calls (/api/*)        │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Express.js Backend (Node 20)               │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌─────────┐ │
│  │ /api/auth│ │/api/audit│ │/api/fix│ │/api/ │ │/api/blog│ │
│  │  OAuth   │ │  GEO AI  │ │GraphQL │ │proxy │ │ AI+REST │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └──┬───┘ └────┬────┘ │
│       │             │           │         │          │       │
│  ┌────▼─────────────▼───────────▼─────────▼──────────▼────┐ │
│  │              Service Layer                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │ │
│  │  │shopify/rest │  │  ai/gemini   │  │  ai/gemma     │  │ │
│  │  │shopify/data │  │ (Store Audit)│  │(Product/Blog) │  │ │
│  │  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │ │
│  └─────────┼────────────────┼──────────────────┼──────────┘ │
└────────────┼────────────────┼──────────────────┼────────────┘
             │                │                  │
     ┌───────▼──────┐  ┌─────▼──────┐  ┌───────▼────────┐
     │ Shopify Admin│  │  Gemini    │  │  Gemma 4 31B   │
     │   GraphQL +  │  │  3 Flash   │  │  (Multimodal)  │
     │   REST API   │  │  Preview   │  │                │
     └──────────────┘  └────────────┘  └────────────────┘
```

### Data Flow (Store Audit)

1. **Frontend** triggers audit → `POST /api/audit/store`
2. **Backend** fetches fresh data from Shopify (GraphQL + 6 parallel REST calls) — never trusts client-supplied data
3. Store data is transformed, trimmed, and sent to **Gemini Flash** with the GEO system prompt
4. Gemini returns structured JSON (scores, issues, fixes)
5. `storeContextSynthesis` is saved server-side as internal policy (never exposed to frontend)
6. Product deep-dives later reference this policy for cross-validation

### Data Flow (Product Analysis)

1. **Frontend** triggers product analysis → `POST /api/audit/product`
2. **Backend** loads saved store context + product data
3. Product images are fetched and base64-encoded for multimodal analysis
4. **Gemma 4 31B** runs 15 diagnostic tests with image cross-validation
5. Returns scored analysis with concrete, API-ready fixes

---

## The 10 GEO Principles (Research-Backed)

Axiom's entire audit framework is built on 10 GEO principles distilled from recent academic research on how generative AI engines select, rank, and cite e-commerce content:

| # | Principle | What It Means | How Axiom Tests It |
|---|-----------|---------------|-------------------|
| 1 | **Third-Party Authority** | AI favors earned media (reviews, expert mentions) over brand-owned content | Checks for review signals, expert quotes, certification references |
| 2 | **AI Answer Visibility** | Success = appearing inside the AI's response, not just being indexed | Evaluates if content is "citation-ready" with quotable statements |
| 3 | **Justifiability** | AI is a decision engine — content must explain *why* | Counts "ideal for", "best for", "recommended because" fragments (min 3/product) |
| 4 | **Structured Data** | Treat your store as an API for AI | Audits JSON-LD completeness, FAQ markup, product schema |
| 5 | **High-Impact Strategies** | Stats (+30-40%), Citations (+30-40%), Quotes (+25-35%), Fluency (+15-30%) | Measures statistics density (min 5/product), citation readiness, prose quality |
| 6 | **Engine-Specific Optimization** | GPT wants authority, Gemini wants structure, Perplexity wants citations | Cross-engine scoring layer evaluates optimization for each platform |
| 7 | **Full Purchase Journey** | Content must cover Awareness → Consideration → Decision → Post-purchase | Checks for guides, comparison pages, pricing transparency, care instructions |
| 8 | **GEO Defense** | Build a moat of high-authority content to prevent competitor displacement | Identifies content gaps competitors could exploit |
| 9 | **The Equalizer** | GEO offers +115% boost for lower-ranked sites — quality beats brand size | Prioritizes high-impact, low-effort fixes for smaller stores |
| 10 | **AI Readability** | Semantic clarity and extraction readiness over keyword density | Tests scannability, Q&A format, standalone factual statements |

**Research Foundation**: These principles are derived from the paper *"GEO: Generative Engine Optimization"* (Aggarwal et al., 2023) and subsequent industry analyses on AI-driven product discovery patterns.

---

## AI Pipeline: Dual-Model Strategy

### Why Two Models?

| Aspect | Gemini 3 Flash (Store Audit) | Gemma 4 31B IT (Product/Blog) |
|--------|------|------|
| **Purpose** | Holistic store-level GEO audit | Granular per-product/article analysis |
| **Input Size** | ~50 products + policies + blogs (~5K-50K tokens) | Single product + images (~2K-5K tokens) |
| **Modality** | Text-only | **Multimodal** (text + product images) |
| **Output** | 6 layer scores + 4 category scores + action plan | 4 category scores + 15 test results + fixes |
| **Temperature** | 0.1 (deterministic, consistent scoring) | 0.1 (analysis) / 0.7 (blog generation) |
| **Why This Model** | Fast, handles large context windows | Best open-weight model for structured image+text analysis |

### 2-Layer API Fallback System

Every AI call is protected by a cascading fallback chain to ensure **zero downtime**:

```
Request
  │
  ├─► Primary API Key + Model 1 (gemini-3-flash-preview)
  │     └─ If 429/503/404 → continue
  │
  ├─► Primary API Key + Model 2 (gemini-2.5-flash)
  │     └─ If 429/503/404 → continue
  │
  ├─► Fallback API Key + Model 1
  │     └─ If 429/503/404 → continue
  │
  └─► Fallback API Key + Model 2
        └─ If all fail → graceful degradation with error message
```

For product analysis (Gemma), additional retry logic with exponential backoff:
- **2 retries per key** with 1.5s × attempt delay
- **Finish reason validation** (blocks `SAFETY`, `RECITATION` responses)
- **Structural validation** (ensures `overallScore` exists before accepting)
- **Graceful fallback**: returns a neutral score (50) with system error issue rather than crashing

---

## Advanced System Prompt Engineering

### Store Audit Prompt (Gemini) — Key Design Decisions

1. **Deductive Scoring**: Every category starts at 100, deductions only for verified issues. This prevents the common LLM problem of arbitrary score assignment and ensures **monotonic improvement** — applying a fix can never lower a score.

2. **Anti-Hallucination Protocol**: The prompt explicitly states *"If data is missing, state DATA MISSING, apply the deduction, and do not hallucinate data."*

3. **Plain Language Enforcement**: The prompt contains a blocklist of technical terms (JSON-LD, canonical, slug, metafield, E-E-A-T) and requires plain equivalents. This ensures outputs are merchant-friendly without post-processing.

4. **Actionable Fix Generation**: Every diagnostic finding must include a `fixes[]` array with exact `oldValue`/`newValue` pairs and Shopify resource IDs — making the AI output directly machine-applicable.

5. **Store Context Synthesis**: The AI generates a ~400 word internal "store identity profile" that captures brand voice, target demographic, and core policies. This is saved server-side and injected into subsequent product analyses for cross-validation.

### Product Analysis Prompt (Gemma) — 15 Diagnostic Tests

The product prompt runs **15 specific, enumerated tests** across 4 categories:

- **SEO (T1-T4)**: Title structure, snippet readiness, keyword density, URL slug quality
- **GEO (T5-T8)**: Statistics density, justification fragments, citation readiness, comparison anchors
- **Content (T9-T12)**: Description depth, image-description cross-validation, policy compliance, tag quality
- **Image (T13-T15)**: Count & diversity, alt text audit, visual quality assessment (multimodal)

### Blog Analysis Prompt (Gemma) — 12 Diagnostic Tests

- **SEO (T1-T4)**: Title optimization, heading structure, keyword strategy, snippet readiness
- **Readability (T5-T8)**: Paragraph length, sentence complexity, scannability, word count
- **GEO (T9-T12)**: Statistics density, recommendation fragments, E-E-A-T signals, FAQ readiness

---

## Security & Authentication

### OAuth 2.0 Implementation

Axiom implements the complete **Shopify OAuth 2.0 authorization code flow** with expiring tokens:

```
Merchant clicks "Install"
       │
       ▼
GET /api/auth?shop=store.myshopify.com
       │
       ▼
Redirect → Shopify OAuth consent screen
  (client_id, scopes, redirect_uri, state nonce)
       │
       ▼
Shopify redirects → /api/auth/callback?code=...&hmac=...
       │
       ├─ HMAC-SHA256 verification (timing-safe comparison)
       ├─ Authorization code → access_token exchange
       ├─ Token + refresh_token stored server-side
       └─ Redirect back into Shopify Admin
```

**Security measures:**
- **HMAC validation**: Every callback is verified using `crypto.timingSafeEqual` to prevent timing attacks
- **Server-side token storage**: Tokens never reach the frontend; stored in an in-memory Map
- **Automatic token refresh**: When tokens expire, the backend silently refreshes using the stored `refresh_token`
- **401 auto-recovery**: Frontend `authGuard` utility detects expired sessions and triggers re-authentication
- **Data forgery prevention**: The audit endpoint fetches store data server-side using admin tokens — never trusts client-supplied payloads
- **CSP headers**: `frame-ancestors` restricted to `*.myshopify.com` and `admin.shopify.com`

### Requested Scopes
```
read_products, write_products, read_content, write_content,
read_customers, read_orders, read_inventory, write_inventory,
read_discounts, write_discounts, read_themes, write_theme_code,
read_legal_policies, write_legal_policies, read_files, write_files,
read_translations, write_translations, read_locales, write_locales
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 19 + TypeScript | Type-safe component architecture |
| **UI Framework** | Shopify Polaris v13 | Native Shopify Admin look & feel, accessibility built-in |
| **Backend** | Express 5 (Node.js) | Lightweight, handles proxy + API routing |
| **Build Tool** | Vite 8 | Sub-second HMR, optimized production builds |
| **Store Audit AI** | Gemini 3 Flash Preview | Large context window, fast, structured JSON output |
| **Product/Blog AI** | Gemma 4 31B IT | Multimodal (text+image), best open-weight model for structured analysis |
| **Shopify API** | Admin GraphQL + REST (2024-10) | GraphQL for mutations, REST for policies/blogs/discounts |
| **Auth** | OAuth 2.0 + HMAC-SHA256 | Shopify-compliant, expiring tokens with refresh |
| **Hosting** | Render | Auto-deploy from GitHub, free tier compatible |

---

## Setup & Installation

### Prerequisites
- Node.js 20+
- A Shopify Partner account with a development store
- Google AI API key (Gemini)

### Local Development

```bash
# 1. Clone
git clone https://github.com/omkar-prabhu-github/shopify.git
cd shopify

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your keys (see below)

# 4. Start development (backend + frontend concurrently)
npm start
# Backend runs on :3000, Vite dev server on :5173
# Backend proxies all non-API requests to Vite
```

### Environment Variables

```env
SHOPIFY_CLIENT_ID=your_app_client_id
SHOPIFY_CLIENT_SECRET=your_app_client_secret
SHOPIFY_APP_URL=https://your-app.onrender.com
GEMINI_API_KEY=your_primary_gemini_key
GEMINI_API_KEY_FALLBACK=your_fallback_gemini_key
VITE_SHOPIFY_API_KEY=your_app_client_id
NODE_ENV=production
```

### Production Deployment (Render)

1. Connect your GitHub repo to Render
2. **Build Command**: `npm install --legacy-peer-deps --include=dev && npm run build`
3. **Start Command**: `node backend/server.js`
4. Set all environment variables in Render dashboard
5. In Shopify Partner Dashboard:
   - **App URL**: `https://your-app.onrender.com`
   - **Allowed redirection URL**: `https://your-app.onrender.com/api/auth/callback`

---

## Design Decisions & Tradeoffs

### 1. Server-Side Data Fetching (Security > Speed)
**Decision**: The audit endpoint fetches all store data server-side using admin tokens, never accepting client-supplied payloads.
**Tradeoff**: Adds ~2-5s latency vs. passing frontend data directly.
**Rationale**: Prevents data forgery. A malicious actor could send fake store data to get a perfect score. Server-side fetching ensures audit integrity.

### 2. Dual-Model Architecture (Specialization > Simplicity)
**Decision**: Use Gemini for store-level audits, Gemma for product-level analysis.
**Tradeoff**: More complex codebase, two sets of prompts to maintain.
**Rationale**: Gemini excels at large-context reasoning (50 products at once). Gemma 4 excels at multimodal analysis (text + product images). Using each model's strength produces higher-quality results than forcing one model to do both.

### 3. Deductive Scoring (Consistency > Flexibility)
**Decision**: All scores start at 100, deducting only for verified issues.
**Tradeoff**: May seem harsh (stores rarely score above 70).
**Rationale**: Prevents the #1 LLM scoring problem: arbitrary initial scores that fluctuate between runs. Deductive scoring is monotonic — fixing an issue always improves the score, never reduces it.

### 4. In-Memory Token Storage (Simplicity > Persistence)
**Decision**: OAuth tokens stored in a JavaScript `Map`, not a database.
**Tradeoff**: Tokens lost on server restart; merchants must re-authenticate.
**Rationale**: For hackathon scope, this eliminates database setup complexity. Production would use Redis or PostgreSQL.

### 5. Plain Language Blocklist (UX > Technical Precision)
**Decision**: System prompts contain a blocklist of technical terms and require plain-language equivalents.
**Tradeoff**: Power users might want technical details.
**Rationale**: Target users are non-technical store owners. "Your product info isn't set up for AI" is actionable; "Missing JSON-LD ProductSchema with aggregateRating" is not.

---

## Decision Log

| Date | Decision | Context |
|------|----------|---------|
| Week 1 | Chose Polaris over custom UI | Judges value native Shopify integration; Polaris ensures consistency |
| Week 1 | OAuth 2.0 over manual token entry | Production-grade auth flow demonstrates real app architecture |
| Week 1 | Dual AI models (Gemini + Gemma) | Each model's strengths match different analysis needs |
| Week 2 | Added multimodal image analysis | Differentiator: no other audit tool analyzes actual product images |
| Week 2 | Built blog generation + publish pipeline | Extends value beyond audit into content creation |
| Week 2 | Deductive scoring methodology | Solves LLM score instability; ensures fixes always improve scores |
| Week 2 | Server-side data fetching | Security requirement: prevents data forgery in audit results |
| Week 3 | 2-layer API fallback chain | Zero-downtime requirement for live demo reliability |
| Week 3 | Deployed to Render | Free tier suitable for demo; auto-deploy from GitHub |

---

## File Structure

```
shopify/
├── backend/
│   ├── server.js              # Express server, OAuth routes, static serving
│   ├── store.js               # In-memory token + policy store
│   ├── routes/
│   │   ├── auth.js            # OAuth 2.0 flow (install, callback, session)
│   │   ├── shopify-proxy.js   # Secure proxy to Shopify Admin API
│   │   ├── ai-audit.js        # GEO audit + product analysis endpoints
│   │   ├── fix.js             # GraphQL mutation engine (apply fixes)
│   │   └── blog.js            # Blog analysis, generation, publishing
│   └── services/
│       ├── ai/
│       │   ├── gemini.js      # Store audit (Gemini Flash, 10 GEO principles)
│       │   └── gemma.js       # Product analysis (15 tests) + Blog (12 tests)
│       └── shopify/
│           ├── rest.js        # HTTPS client, token refresh, REST helper
│           └── data.js        # Secure store data fetcher (GraphQL + REST)
├── src/
│   ├── App.tsx                # Root: embedded detection, OAuth, routing
│   ├── main.tsx               # Polaris AppProvider wrapper
│   ├── api/
│   │   └── fixClient.ts       # Fix mutation API client
│   ├── features/
│   │   ├── auth/
│   │   │   └── LoginView.tsx  # Standalone OAuth install page
│   │   ├── extraction/
│   │   │   └── ExtractingView.tsx
│   │   └── dashboard/
│   │       ├── AppShell.tsx          # Tab navigation shell
│   │       ├── DashboardContext.tsx   # Shared state (data, audit, actions)
│   │       ├── pages/
│   │       │   ├── OverviewPage.tsx   # GEO health gauge + layer scores
│   │       │   ├── ActionsPage.tsx    # Prioritized fix action plan
│   │       │   ├── ProductsPage.tsx   # Per-product deep analysis
│   │       │   └── BlogsPage.tsx      # Blog analysis + AI generation
│   │       └── components/
│   │           ├── HealthGauge.tsx     # Animated SVG score gauge
│   │           ├── ActionItemCard.tsx  # Severity-tagged issue card
│   │           ├── FixPreviewModal.tsx # Editable fix preview + apply
│   │           └── ProductRow.tsx      # Expandable product analysis row
│   ├── utils/
│   │   ├── authGuard.ts       # 401 auto-recovery + session management
│   │   ├── friendlyError.ts   # User-friendly error message mapping
│   │   └── aiFixRegistry.ts   # Tracks applied fixes to prevent re-suggestion
│   └── lib/
│       └── shopify.ts         # Frontend Shopify data fetcher (GraphQL + REST)
├── package.json
├── vite.config.ts
└── index.html
```

---

## License

Built for the **Kasparro Agentic Commerce Hackathon** (April 2026).

---

*Axiom doesn't just tell you what's wrong — it fixes it. One click at a time.*
