# ⚙️ Axiom — Technical Documentation
**AI Representation Optimizer for Shopify | Kasparro Hackathon Track 5 | April 2026**

---

## 1. System Architecture

Axiom is a Shopify Embedded App with a two-layer backend: a deterministic data and mutation layer (Shopify API), and an AI reasoning layer (Gemini + Gemma). These layers are kept strictly separate.

### 1.1 High-Level Component Map

```
┌──────────────────────────────────────────────────────────────────┐
│                  REACT FRONTEND  (Vite 8 + TypeScript)           │
│                  Shopify Polaris Design System                   │
│                                                                  │
│  LoginView ──→ ExtractingView ──→ AppShell (Dashboard)           │
│                                       │                         │
│          ┌────────────┬───────────────┼──────────────┐          │
│          │            │               │              │          │
│     OverviewPage  ActionsPage   ProductsPage    BlogsPage        │
│     (GEO gauge)  (sorted plan)  (15-test AI)   (AI content)     │
│          │            │               │              │          │
│          └────────────┴───────────────┴──────────────┘          │
│                               │                                  │
│                  DashboardContext (shared state)                 │
└───────────────────────────────┬──────────────────────────────────┘
                                │  HTTPS + JSON
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   EXPRESS 5 BACKEND  (Node.js ESM)               │
│                                                                  │
│  ┌──────────────┬────────────────┬────────────┬───────────────┐  │
│  │ /api/auth    │ /api/shopify   │ /api/audit │ /api/fix      │  │
│  │ OAuth 2.0   │ Data proxy     │ AI audit   │ Mutations     │  │
│  │ Token store  │ (passthrough)  │ orchestr.  │ GID resolver  │  │
│  └──────────────┴────────────────┴────────────┴───────────────┘  │
│                      /api/blog (analyze + generate + publish)     │
│                                                                  │
│              In-memory stores: tokenStore / policyStore          │
└────────────┬─────────────────────────────────┬───────────────────┘
             │                                 │
             ▼                                 ▼
┌────────────────────────┐       ┌─────────────────────────────────┐
│  SHOPIFY ADMIN API     │       │    GOOGLE AI PLATFORM           │
│                        │       │                                 │
│  GraphQL  2024-10      │       │  gemini-2.5-flash               │
│  ├─ Products (50)      │       │  ├─ Store-level GEO audit       │
│  ├─ Collections        │       │  └─ 1M token context window     │
│  ├─ Pages              │       │                                 │
│  ├─ Blogs + Articles   │       │  gemini-3-flash-preview         │
│  └─ Mutations          │       │  └─ Fallback model              │
│                        │       │                                 │
│  REST  2023-10         │       │  gemma-4-31b-it                 │
│  ├─ Policies           │       │  ├─ Per-product deep analysis   │
│  ├─ Discounts          │       │  ├─ Blog analysis               │
│  ├─ Customers count    │       │  ├─ Blog generation             │
│  ├─ Orders count       │       │  └─ Multimodal (images+text)   │
│  └─ Redirects          │       │                                 │
└────────────────────────┘       └─────────────────────────────────┘
```

---

### 1.2 Request Lifecycle — Store GEO Audit

```
Frontend                 Backend                   External
────────                 ───────                   ────────

[Run GEO Audit]
       │
       │  POST /api/audit/store
       │  Headers: x-shopify-domain
       │           x-shopify-token
       ▼
                  [Validate token]
                  [getValidToken()]
                         │
                         │  GraphQL query (50 products,
                         │  collections, pages, blogs)
                         │─────────────────────────────────▶ Shopify Admin
                         │                                        │
                         │  REST: policies, discounts,            │
                         │        customers, orders               │
                         │─────────────────────────────────▶ Shopify REST
                         │                                        │
                         │◀────────────────────────────────── JSON responses
                         │
                  [fetchInternalStoreData()]
                  [Transform + normalize data]
                         │
                         │  JSON payload (~200k tokens)
                         │─────────────────────────────────▶ Gemini 2.5-flash
                         │                                        │
                         │  [If rate limit / 503 / 404]          │
                         │     retry gemini-3-flash-preview       │
                         │     retry with secondary API key       │
                         │◀────────────────────────────── Structured JSON audit
                         │
                  [Save storeContextSynthesis → policyStore]
                  [Strip synthesis from response]
                         │
       │◀─────── GEO audit JSON (scores, issues, action plan)
       │
[Render OverviewPage + ActionsPage]
```

---

### 1.3 Request Lifecycle — Per-Product Deep Analysis

```
Frontend                 Backend                    External
────────                 ───────                    ────────

[Click product → Run Analysis]
       │
       │  POST /api/audit/product
       │  Body: { product }
       ▼
                  [Validate token]
                  [Load policyStore → store context synthesis]
                         │
                         │  Fetch up to 3 product images
                         │─────────────────────────────────▶ CDN (image URLs)
                         │◀────────────────────────────────── base64 image data
                         │
                  [Build multimodal content parts]
                  [text: product JSON]
                  [inline_data: image base64 × N]
                         │
                         │  Multimodal payload
                         │─────────────────────────────────▶ gemma-4-31b-it
                         │
                         │  [On failure: retry × 2]
                         │  [On key exhaustion: secondary API key]
                         │◀────────────────────────── 15-test analysis JSON
                         │
       │◀─────── { overallScore, riskLevel, issues[], fixes[] }
       │
[Render scores + issue list + one-click fixes]
```

---

## 2. AI / Deterministic Boundary

The most critical architectural decision in Axiom. Every operation is classified into exactly one of two types. Mixing them causes instability.

```
┌──────────────────────────────────────────────────────────────┐
│                  DETERMINISTIC LAYER                         │
│         (correctness required — no variance acceptable)      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Data Extraction      fetchInternalStoreData()        │  │
│  │  GraphQL schema guarantees exact shape every time     │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Score Formula        Deductive math in system prompt │  │
│  │  Start 100, deduct for specific evidence only         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  GID Resolution       resolveResourceId()             │  │
│  │  Handle → GID lookup is a database operation          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Fix Application      GraphQL mutations via fix.js    │  │
│  │  Exact, reversible, auditable — no inference          │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    AI REASONING LAYER                        │
│         (judgment required — rules cannot substitute)        │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Issue Identification  Gemini / Gemma                 │  │
│  │  Contextual, semantic, brand-aware reasoning          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Fix Content Generation  Gemini / Gemma               │  │
│  │  Full rewrites with brand voice + store context       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Image Evaluation      Gemma 4 (multimodal)           │  │
│  │  No rule-based image quality metric exists            │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Blog Generation       Gemma 4                        │  │
│  │  Brand-aligned long-form content creation             │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. GEO Audit Engine

### 3.1 Store-Level Audit — Six GEO Layers

```
Store Payload (JSON)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                     Gemini 2.5-flash                          │
│              system_instruction: 10 GEO Principles            │
│                  temperature: 0.1 (deterministic)             │
│               responseMimeType: "application/json"            │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
           ┌──────────────────────────────────────┐
           │         GEO LAYER SCORES             │
           │                                      │
           │  Schema & Structured Data   /20 pts  │
           │  Content Quality            /20 pts  │
           │  Trust Signals              /15 pts  │
           │  Extractability             /15 pts  │
           │  Journey & Policy           /20 pts  │
           │  Cross-Engine Visibility    /10 pts  │
           │                          ──────────  │
           │  GEO Health Score        /100 pts    │
           └──────────────────────────────────────┘
                               │
                               ▼
           ┌──────────────────────────────────────┐
           │       CATEGORY ISSUE BUCKETS         │
           │                                      │
           │  storeInfrastructure   (pages, policies, nav)    │
           │  informationMismatch   (contradictions)          │
           │  productOptimization   (GEO gaps, metadata)      │
           │  strategicGrowth       (trust, domain, reviews)  │
           └──────────────────────────────────────┘
                               │
                               ▼
           ┌──────────────────────────────────────┐
           │     DEDUCTIVE SCORING ENGINE         │
           │                                      │
           │  Each category starts at 100         │
           │  CRITICAL issue  → −20 pts           │
           │  HIGH issue      → −10 pts           │
           │  MEDIUM issue    →  −5 pts           │
           │  LOW issue       →  −2 pts           │
           │                                      │
           │  Score never rises without a fix     │
           │  AI cannot hallucinate improvements  │
           └──────────────────────────────────────┘
```

### 3.2 Store Context Synthesis — The Coherence Layer

```
        Gemini full-store audit
                │
                │  Generates 400-word compressed brand identity:
                │  • Store identity + target demographic
                │  • Product categories + price positioning
                │  • Core policies (shipping, returns)
                │  • Value propositions + brand voice
                ▼
          ┌─────────────────────────────┐
          │     policyStore (server)    │  ← Never sent to frontend
          │     shop → { policy, ts }  │  ← Prevents score gaming
          └─────────────────────────────┘
                │
                │  Injected as ground truth into every
                │  per-product and blog analysis
                ▼
          [Per-product Gemma calls]
          [Blog analysis / generation]

  Why server-side only:
  If merchants can read the synthesis, they craft descriptions
  to match it — gaming the score rather than improving GEO.
```

### 3.3 Per-Product Analysis — 15 Diagnostic Tests

```
Product JSON + Product Images (base64)
             │
             ▼
┌────────────────────────────────────────────────────────────────┐
│                    gemma-4-31b-it  (multimodal)                │
│          Injected: Store Context Synthesis as system prompt     │
└───────────┬───────────────┬───────────────┬────────────────────┘
            │               │               │
            ▼               ▼               ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
   │  SEO TESTS  │  │  GEO TESTS  │  │CONTENT TESTS│  │ IMAGE TESTS  │
   │             │  │             │  │             │  │              │
   │ T1 Title    │  │ T5 Stats    │  │ T9 Depth    │  │ T13 Count    │
   │    structure│  │    density  │  │    & WC     │  │     diversity│
   │             │  │    (≥5)     │  │             │  │              │
   │ T2 Snippet  │  │ T6 Justif. │  │ T10 Desc ↔  │  │ T14 Alt text │
   │    readiness│  │    fragments│  │     Image   │  │     quality  │
   │             │  │    (≥3)     │  │     X-val   │  │              │
   │ T3 Keyword  │  │ T7 Citation │  │ T11 Policy  │  │ T15 Visual   │
   │    density  │  │    ready    │  │    compliance│  │     quality  │
   │             │  │             │  │             │  │ (actual image│
   │ T4 URL slug │  │ T8 Compare  │  │ T12 Tag     │  │  analysis)   │
   │    quality  │  │    anchors  │  │    quality  │  │              │
   └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘
            │               │               │                │
            └───────────────┴───────────────┴────────────────┘
                                    │
                                    ▼
                 { overallScore, riskLevel, seoScore,
                   geoScore, contentScore, imageScore,
                   issues[], fixes[] }
```

---

## 4. Fix Engine

### 4.1 End-to-End Fix Pipeline

```
AI Audit Output
      │
      │  diagnosticsAndActionPlan[category][n].fixes[]
      │  Each fix: { type, resourceId, field, oldValue, newValue, label }
      ▼
┌─────────────────────────────────────────────────────────┐
│                  ActionsPage / ProductsPage             │
│                                                         │
│  "Preview & Fix" button clicked                         │
│         │                                               │
│         ▼                                               │
│  FixPreviewModal opens                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  DIFF VIEW                                      │   │
│  │  ─────────────────────────────────────────────  │   │
│  │  Current value  (red background)               │   │
│  │  ↓ proposed change                             │   │
│  │  Proposed value (green, EDITABLE textarea)     │   │
│  └─────────────────────────────────────────────────┘   │
│         │                                               │
│         │  [Apply Fix] clicked                          │
└─────────┼───────────────────────────────────────────────┘
          │
          │  POST /api/fix/apply
          │  Headers: x-shopify-domain, x-shopify-token
          │  Body: { type, resourceId, newValue, resourceTitle }
          ▼
┌─────────────────────────────────────────────────────────┐
│                  fix.js — GID Resolution                │
│                                                         │
│  AI provides: "gid://shopify/Product/the-snowboard"     │
│  (fake GID — handle in ID position)                     │
│                                                         │
│  Strategy 1: GraphQL handle search                      │
│    { products(query: "handle:the-snowboard") { id } }   │
│         │                                               │
│         │ not found?                                    │
│         ▼                                               │
│  Strategy 2: Title search                               │
│    { products(query: "title:The Snowboard") { id } }    │
│         │                                               │
│         │ not found?                                    │
│         ▼                                               │
│  Strategy 3: Kebab-case conversion + retry              │
│    theSnowboard → the-snowboard → handle search         │
│         │                                               │
│         ▼                                               │
│  Resolved: "gid://shopify/Product/8234567890"  ✓        │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                  GraphQL Mutation Layer                  │
│                                                         │
│  product_title      → productUpdate { id, title }       │
│  product_description → productUpdate { id, descriptionHtml } │
│  product_tags       → productUpdate { id, tags }        │
│  product_metafield  → metafieldsSet { ownerId, key }    │
│  page_content       → pageUpdate { id, body }           │
│                       ↳ fallback: pageCreate            │
│  page_title         → pageUpdate { id, title }          │
│  collection_description → collectionUpdate { id }       │
│  shop_policy        → shopPolicyUpdate { type, body }   │
│  article_title/body/tags → articleUpdate { id }         │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                Post-Fix Actions (Frontend)              │
│                                                         │
│  1. registerAIFix(resourceId, field, label)             │
│     → Added to fix registry                             │
│     → This (resourceId + field + label) never           │
│       suggested again in current session                │
│                                                         │
│  2. refreshData() called in background                  │
│     → Full store re-extraction                          │
│     → Dashboard updates silently                        │
│     → No page reload, no spinner                        │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Supported Fix Types

| Fix Type | Shopify Operation | Target |
|---|---|---|
| `product_title` | `productUpdate` | Product title field |
| `product_description` | `productUpdate` | `descriptionHtml` field |
| `product_tags` | `productUpdate` | Tags array |
| `product_metafield` | `metafieldsSet` | Custom namespace + key |
| `page_content` | `pageUpdate` → fallback `pageCreate` | Page body |
| `page_title` | `pageUpdate` | Page title |
| `collection_description` | `collectionUpdate` | `descriptionHtml` |
| `shop_policy` | `shopPolicyUpdate` | REFUND / PRIVACY / SHIPPING / TOS |
| `article_title` | `articleUpdate` | Blog article title |
| `article_body` | `articleUpdate` | Blog article body HTML |
| `article_tags` | `articleUpdate` | Blog article tags |

---

## 5. Reliability & Failure Handling

### 5.1 AI Model Fallback Chain

```
                  Gemini Store Audit Request
                           │
                           ▼
               ┌───────────────────────┐
               │  Primary API Key      │
               │  gemini-3-flash-      │
               │  preview              │
               └───────────┬───────────┘
                           │ 429 / 503 / 404 / overloaded?
                           ▼
               ┌───────────────────────┐
               │  Primary API Key      │
               │  gemini-2.5-flash     │
               └───────────┬───────────┘
                           │ still failing?
                           ▼
               ┌───────────────────────┐
               │  Secondary API Key    │
               │  gemini-3-flash-      │
               │  preview              │
               └───────────┬───────────┘
                           │ still failing?
                           ▼
               ┌───────────────────────┐
               │  Secondary API Key    │
               │  gemini-2.5-flash     │
               └───────────┬───────────┘
                           │ all failed?
                           ▼
                    Surface error to user
                  "All models and API keys
                      failed. Last: ..."
```

### 5.2 Gemma Per-Product Retry Strategy

```
  For each API key:
    For attempt 0, 1, 2:
      │
      ├─ Send request to gemma-4-31b-it
      │
      ├─ On success → return analysis
      │
      ├─ On HTTP error → log, increment attempt
      │    Delay: 1500ms × attempt (exponential backoff)
      │
      ├─ On blocked finishReason → log, increment attempt
      │
      └─ On empty / unparseable JSON → log, increment attempt
  
  If all retries exhausted for primary key → try secondary key
  
  If both keys exhausted:
    Return graceful fallback:
    { overallScore: 50, riskLevel: "MEDIUM",
      issues: [{ title: "Analysis failed — try again" }],
      fixes: [] }
    (Dashboard stays functional; no crash)
```

### 5.3 Complete Failure Mode Matrix

| Failure Mode | Detection | Recovery Strategy |
|---|---|---|
| Gemini 429 rate limit | HTTP status + error message | Auto-fallback to next model/key |
| Gemini "high demand" / overloaded | Error message string match | Auto-fallback |
| Gemini model not found (404) | HTTP 404 | Skip, try next model |
| Gemma response blocked | `finishReason !== STOP` | Retry with backoff |
| Gemma returns empty text | `rawText === ''` | Retry |
| Gemma returns malformed JSON | `JSON.parse` throws | `extractJSON()` bracket-matching fallback |
| Product image fetch fails | HTTP response check | Skip image, proceed text-only |
| Fix mutation — page doesn't exist | `userErrors` non-empty | Fallback: `page_content` → `page_create` |
| Fix mutation — policy auto-managed | `userErrors` contains "automatic" | Return manual instructions with exact Admin path |
| AI returns handle instead of GID | `lastPart` not numeric | 3-strategy GID resolution |
| Token store cleared (process restart) | Session lookup miss | Re-initiate OAuth flow |
| Payload exceeds ~200k tokens | Token count estimate > 200k | Truncate products from 50 → 30 |

---

## 6. Security & Data Integrity

### 6.1 Authentication Flow

```
  Merchant installs app
         │
         │  GET /?shop=mystore.myshopify.com
         ▼
  ┌─────────────────────────┐
  │  tokenStore.get(shop)   │
  │  Token cached?          │
  └─────────┬───────────────┘
            │ No                   │ Yes
            ▼                      ▼
  GET /api/auth              Serve React app
  (Shopify OAuth redirect)   (token from session)
         │
         │  Shopify Authorization URL
         ▼
  Merchant approves scopes in Shopify
         │
         │  OAuth callback with code
         ▼
  POST exchange: code → access_token
         │
         │  tokenStore.set(shop, { accessToken })
         ▼
  Redirect → React app
  (token in sessionStorage)

  Every subsequent API request:
  Headers: x-shopify-domain + x-shopify-token
  Backend: getValidToken(shop, reqToken) validates both
```

### 6.2 Data Forgery Prevention

```
  ❌  REJECTED APPROACH:
  Client sends { storeData: { products: [...] } }
  → Backend uses client-provided data for audit
  → Merchant could send fabricated store data
  → Get falsely high GEO scores

  ✅  AXIOM APPROACH:
  Client sends:  POST /api/audit/store
                 Headers: x-shopify-domain, x-shopify-token
                 Body: {} (empty — ignored)

  Backend independently:
    → Calls getValidToken() to authenticate
    → Calls fetchInternalStoreData() with admin token
    → Sends that data (not the client's) to Gemini
    → Scores reflect the real store, always

  Code comment in ai-audit.js:
  // SECURITY PATCH: Do NOT accept request bodies from clients (Data Forgery)
  // Always fetch data natively on the backend via admin tokens
```

### 6.3 Store Context Synthesis — Integrity Protection

```
  Gemini audit generates:
  { storeContextSynthesis: "400-word brand identity...",
    executiveSummary: { ... },
    ...rest of audit }

  Backend:
  policyStore.set(shop, { policy: storeContextSynthesis })

  // Strip before sending to frontend:
  const { storeContextSynthesis, ...frontendAudit } = audit;
  return frontendAudit;

  Why: If merchants can read the synthesis, they reverse-engineer
  the scoring criteria and craft descriptions toward it — gaming
  the GEO score rather than improving actual AI readiness.
  The synthesis is an internal evaluation tool, not a merchant deliverable.
```

---

## 7. Blog Engine

### 7.1 Blog Analysis Flow

```
  [Merchant selects article]
         │
         │  POST /api/blog/analyze
         │  Body: { article: { title, body, tags, author } }
         ▼
  ┌──────────────────────────────────────────┐
  │  runBlogAnalysis(shop, article)          │
  │                                          │
  │  Inject: policyStore context (if exists) │
  │  Run: 12 diagnostic tests via Gemma 4   │
  │                                          │
  │  SEO (4 tests):                          │
  │    Title optimization, heading structure,│
  │    keyword strategy, snippet readiness   │
  │                                          │
  │  Readability (4 tests):                  │
  │    Paragraph length, sentence complexity,│
  │    scannability, word count             │
  │                                          │
  │  GEO (4 tests):                          │
  │    Statistics density (≥5),             │
  │    justification fragments (≥3),        │
  │    E-E-A-T signals, FAQ readiness        │
  └──────────────────────────────────────────┘
         │
         ▼
  { seoScore, readabilityScore, geoScore,
    overallScore, wordCount, issues[], suggestions[], fixes[] }
```

### 7.2 Blog Generation + Publish Flow

```
  [Merchant enters topic]
         │
         │  POST /api/blog/generate
         │  Body: { topic, blogId }
         ▼
  runBlogGeneration(shop, topic)
  └─ Inject: policyStore context
  └─ temperature: 0.7 (creative)
  └─ Gemma generates:
       { title, bodyHtml, tags[], metaDescription, summary }
         │
         │  bodyHtml includes:
         │  ├─ <h2>/<h3> hierarchy
         │  ├─ ≥5 quantitative statistics
         │  ├─ ≥3 justification fragments
         │  ├─ FAQ section (3-5 Q&A pairs)
         │  ├─ Short paragraphs + bullet points
         │  └─ Natural product/brand references
         ▼
  If blogId provided:
    POST /admin/api/2024-10/blogs/{blogId}/articles.json
    → Article created as published: true
    → Shopify article ID returned

  Frontend:
    Preview generated content
    Edit if needed
    Select target blog
    Publish with one click
```

---

## 8. Frontend Architecture

### 8.1 State Management

```
  DashboardContext  (React Context — shared across all pages)
  ┌────────────────────────────────────────────────────────┐
  │  data          — raw store extraction (products, etc.) │
  │  shop          — authenticated shop domain             │
  │  audit         — GEO audit result (null until run)     │
  │  auditLoading  — boolean spinner state                 │
  │  auditError    — error message string                  │
  │  policyReady   — bool: store context synthesis exists  │
  │  cachedAudit   — last successful audit                 │
  │  runFullAudit  — function: trigger store audit         │
  │  clearAudit    — function: reset audit state           │
  │  navigate      — function: hash-based SPA routing      │
  │  refreshData   — function: re-extract store data       │
  └────────────────────────────────────────────────────────┘

  useStoreAudit(shop) hook:
  ├─ Calls POST /api/audit/store
  ├─ Manages loading / error state
  └─ Caches result in component state
```

### 8.2 Fix Registry

```
  aiFixRegistry  (module-level Map, persists across renders)

  registerAIFix(resourceId, field, label):
    key = `${resourceId}::${field}::${label}`
    registry.set(key, true)

  filterAlreadyFixed(fixes[]):
    return fixes.filter(f =>
      !registry.has(`${f.resourceId}::${f.field}::${f.label}`)
    )

  Effect:
    Once a fix is applied, that exact (resource + field + label)
    combination is permanently excluded from the UI in the session.
    Prevents duplicate recommendations after partial application.
```

### 8.3 Routing (Hash-Based SPA)

```
  URL hash         → Component
  ─────────────────────────────
  #/               → OverviewPage
  #/actions        → ActionsPage
  #/products       → ProductsPage
  #/blogs          → BlogsPage

  Navigation: window.location.hash = '#' + path
  AppShell listens: window.addEventListener('hashchange', handler)
  No router library; no page reloads; works inside Shopify iframe
```

---

## 9. Prompting Strategy

### 9.1 System Prompt Design Principles

| Principle | Implementation |
|---|---|
| Plain language output | Explicit forbidden-term list: JSON-LD, schema markup, GID, slug, canonical, semantic, metafield |
| No hallucination | "Missing Data Protocol: state DATA MISSING, apply deduction, never invent data" |
| No generic advice | "Every tip MUST reference specific keys, values, or strings from the JSON data" |
| Stable scoring | Deductive math enforced in prompt with explicit point values per severity |
| Machine-applicable fixes | Every action item must include `fixes[]` with exact `oldValue` and complete `newValue` |
| AI-first mindset | "Ask: Would an AI agent cite this product as a top 3 choice?" |

### 9.2 Temperature Strategy

| Task | Temperature | Reason |
|---|---|---|
| Store GEO audit | `0.1` | Reproducible scores across runs; deterministic issue detection |
| Per-product analysis | `0.1` | Consistent 15-test forensic evaluation |
| Blog analysis | `0.1` | Reliable scoring; predictable issue identification |
| Blog generation | `0.7` | Creative, varied content; non-generic long-form output |

### 9.3 Output Format Enforcement

| Model | Enforcement Method |
|---|---|
| Gemini (audit) | `responseMimeType: "application/json"` + custom structural validation |
| Gemma (product) | `responseSchema: PRODUCT_ANALYSIS_SCHEMA` (JSON Schema enforcement) |
| Gemma (blog analyze) | `responseSchema: BLOG_ANALYSIS_SCHEMA` |
| Gemma (blog generate) | `responseSchema: BLOG_GENERATION_SCHEMA` |
| All | `extractJSON()` bracket-matching fallback if primary parse fails |

---

## 10. Data Flow Summary

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                     DATA IN AXIOM                              │
  │                                                                │
  │  Shopify Store Data (read-only, extracted once per session):   │
  │  ├─ 50 products  (title, description, images, variants, tags)  │
  │  ├─ Collections  (title, description, product count)           │
  │  ├─ Custom pages  (body text)                                  │
  │  ├─ Native policies  (refund, privacy, shipping, TOS)          │
  │  ├─ Blog articles  (title, body, author, tags)                 │
  │  ├─ Discounts / price rules                                    │
  │  ├─ Redirects                                                  │
  │  └─ Store metadata  (name, domain, currency, orders, customers)│
  │                                                                │
  │  AI-Generated Data (created per session):                      │
  │  ├─ Store Context Synthesis  → policyStore (server-only)       │
  │  ├─ GEO Audit JSON           → DashboardContext (frontend)     │
  │  ├─ Per-product Analysis     → component state (per product)   │
  │  └─ Generated Blog Content   → Shopify via REST API            │
  │                                                                │
  │  Applied Fixes (write operations):                             │
  │  ├─ Product fields    → Shopify GraphQL mutation               │
  │  ├─ Page content      → Shopify GraphQL mutation               │
  │  ├─ Policies          → Shopify shopPolicyUpdate mutation       │
  │  └─ Blog articles     → Shopify REST articles endpoint         │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 11. Tech Stack Summary

| Layer | Technology | Version | Role |
|---|---|---|---|
| Frontend framework | React | 19.2 | UI rendering + state |
| Build tool | Vite | 8.0 | Dev server + production bundle |
| UI library | Shopify Polaris | 13.9 | Native Shopify Admin design system |
| Language | TypeScript | 6.0 | Type safety across frontend |
| Backend framework | Express | 5.2 | HTTP routing + middleware |
| Runtime | Node.js | ESM | Backend execution |
| AI — store audit | Gemini 2.5-flash | v1beta | Full-store GEO analysis |
| AI — product analysis | Gemma 4 31B | v1beta | 15-test multimodal deep analysis |
| AI — blog | Gemma 4 31B | v1beta | Analysis + generation |
| Shopify data | Admin GraphQL | 2024-10 | Products, pages, mutations |
| Shopify data | Admin REST | 2023-10 | Policies, discounts, blogs |
| Auth | Shopify OAuth 2.0 | — | Merchant authentication |
| Dev tooling | ESLint 9 + concurrently | — | Linting + parallel dev processes |

---

*Axiom — Kasparro Agentic Commerce Hackathon · Track 5 (Advanced) · April 2026*
