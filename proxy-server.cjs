require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cors    = require('cors');
const https   = require('https');
const crypto  = require('crypto');

// ── AI Service Config ────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HF_SPACE_URL  = process.env.HF_SPACE_URL;
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = 3000;

// In-memory token store: shop domain → access_token (use a DB in production)
const tokenStore = new Map();
const policyStore = new Map(); // shop → { policy: string, generatedAt: number }

// ── Shopify OAuth Config ─────────────────────────────────────────────────────
const SHOPIFY_CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_APP_URL       = process.env.SHOPIFY_APP_URL;
const SCOPES                = 'read_products,write_products,read_content,read_customers,read_orders,read_inventory,read_discounts,read_price_rules,read_online_store_pages,read_online_store_navigation';

app.use(cors());
app.use(express.json());

// ── Allow Shopify to embed us in an iframe ───────────────────────────────────
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy',
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com"
  );
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// ██  ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Root route: Shopify hits / with ?shop= when loading embedded ──────────────
app.get('/', (req, res, next) => {
  const { shop, token } = req.query;

  // shop + token in URL → let React handle (auto-extract)
  if (shop && token) return next();

  if (shop) {
    const data = tokenStore.get(shop);
    if (data) {
      const storedToken = typeof data === 'string' ? data : data.accessToken;
      console.log(`🔄 Embedded load for ${shop} — using stored token`);
      
      // Keep existing query params (crucial for Shopify's 'host' param)
      const q = new URLSearchParams(req.query);
      q.set('token', storedToken);
      return res.redirect(`/?${q.toString()}`);
    }
    // No token — kick off OAuth
    return res.redirect(`/api/auth?shop=${shop}`);
  }

  // No shop param — serve the React login page via Vite proxy
  next();
});

// ── Install page: shareable link for store owners ────────────────────────────
app.get('/install', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Install AgentLens</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      padding: 1rem;
    }
    .card {
      background: #fff; border-radius: 24px; padding: 3rem 2.5rem;
      max-width: 420px; width: 100%; box-shadow: 0 25px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .logo {
      width: 64px; height: 64px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 16px; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .logo svg { width: 32px; height: 32px; color: #fff; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5; }
    label { display: block; text-align: left; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 0.5rem; }
    .input-wrap { position: relative; margin-bottom: 0.5rem; }
    input {
      width: 100%; padding: 0.9rem 1.25rem; padding-right: 9rem;
      border: 2px solid #e2e8f0; border-radius: 14px; font-size: 0.95rem;
      font-family: inherit; color: #0f172a; outline: none;
      transition: border-color 0.2s; background: #f8fafc;
    }
    input:focus { border-color: #3b82f6; background: #fff; }
    input::placeholder { color: #94a3b8; }
    .suffix { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.85rem; pointer-events: none; }
    .hint { font-size: 0.8rem; color: #94a3b8; text-align: left; margin-bottom: 1.5rem; }
    button {
      width: 100%; padding: 0.95rem;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #fff; border: none; border-radius: 14px;
      font-size: 1rem; font-weight: 600; font-family: inherit; cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 15px rgba(34,197,94,0.3);
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.4); }
    button:active { transform: translateY(0); }
    .footer { margin-top: 1.5rem; font-size: 0.75rem; color: #94a3b8; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
      </svg>
    </div>
    <h1>Install AgentLens</h1>
    <p class="subtitle">AI-powered store health audit. Enter your Shopify store name below to get started.</p>
    <form onsubmit="handleInstall(event)">
      <label for="shop">Store Name</label>
      <div class="input-wrap">
        <input id="shop" type="text" placeholder="e.g. mystore" required autocomplete="off" autofocus />
        <span class="suffix">.myshopify.com</span>
      </div>
      <p class="hint">This is found in your Shopify admin URL</p>
      <button type="submit">🛡️ Install AgentLens</button>
    </form>
    <p class="footer">By installing, you agree to our <a href="#">Terms</a> &amp; <a href="#">Privacy Policy</a></p>
  </div>
  <script>
    function handleInstall(e) {
      e.preventDefault();
      let shop = document.getElementById('shop').value.trim();
      if (!shop) return;
      if (!shop.includes('.')) shop += '.myshopify.com';
      window.location.href = '/api/auth?shop=' + encodeURIComponent(shop);
    }
  </script>
</body>
</html>`);
});

// ══════════════════════════════════════════════════════════════════════════════
// ██  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function normalizeDomain(domain) {
  let d = domain;
  if (!d.includes('.')) d = `${d}.myshopify.com`;
  if (!d.startsWith('http')) d = `https://${d}`;
  return d;
}

// Forces IPv4 to avoid IPv6 DNS resolution issues on Windows
function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      port:     443,
      method:   options.method || 'GET',
      headers:  options.headers || {},
      family:   4,
      timeout:  30000,
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => JSON.parse(data),
          });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out after 30s')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function shopifyRest(domain, token, path) {
  const url = `${normalizeDomain(domain)}/admin/api/2023-10/${path}`;
  const res = await httpsRequest(url, {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': token },
  });
  if (!res.ok) throw new Error(`REST ${path} failed: ${res.status}`);
  return res.json();
}

async function getValidToken(domain, fallbackToken) {
  const shop = normalizeDomain(domain).replace('https://', '');
  const data = tokenStore.get(shop);

  if (!data) return fallbackToken; // Server restarted, only have frontend's token
  if (typeof data === 'string') return data; // Legacy string format

  const { accessToken, refreshToken, expiresAt } = data;

  // Buffer of 60 seconds before expiration
  if (Date.now() < expiresAt - 60000) return accessToken;

  console.log(`🔄 Token expired for ${shop}, refreshing...`);
  try {
    const payload = JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    const res = await httpsRequest(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, payload);

    const tokenData = res.json();
    if (!res.ok || !tokenData.access_token) throw new Error('Refresh failed');
    
    tokenStore.set(shop, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000)
    });
    console.log(`✅ Token refreshed for ${shop}`);
    return tokenData.access_token;
  } catch (err) {
    console.error(`❌ Failed to refresh token for ${shop}:`, err.message);
    return fallbackToken;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ██  SHOPIFY API PROXY ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── GraphQL proxy ────────────────────────────────────────────────────────────
app.post('/api/shopify', async (req, res) => {
  const domain = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!domain || !reqToken) return res.status(400).json({ error: 'Missing headers' });

  const token = await getValidToken(domain, reqToken);
  const endpoint = `${normalizeDomain(domain)}/admin/api/2023-10/graphql.json`;
  try {
    const bodyStr = JSON.stringify(req.body);
    const shopifyRes = await httpsRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, bodyStr);
    const data = shopifyRes.json();
    if (!shopifyRes.ok || data.errors) {
      console.error(`GraphQL error (${shopifyRes.status}):`, JSON.stringify(data, null, 2));
    }
    if (!shopifyRes.ok) {
      const message = data?.errors?.[0]?.message || data?.error || `HTTP ${shopifyRes.status}`;
      return res.status(shopifyRes.status).json({ proxyError: message, detail: data });
    }
    return res.json(data);
  } catch (err) {
    console.error('Proxy GraphQL error:', err);
    return res.status(500).json({ proxyError: err.message });
  }
});

// ── REST proxy routes ────────────────────────────────────────────────────────
const restRoutes = [
  { path: '/api/shopify/shop',            rest: 'shop.json',                     fallback: { shop: {} } },
  { path: '/api/shopify/policies',        rest: 'policies.json',                 fallback: { policies: [] } },
  { path: '/api/shopify/customers-count', rest: 'customers/count.json',          fallback: { count: 0 } },
  { path: '/api/shopify/orders-count',    rest: 'orders/count.json?status=any',  fallback: { count: 0 } },
  { path: '/api/shopify/redirects',       rest: 'redirects.json?limit=250',      fallback: { redirects: [] } },
];

restRoutes.forEach(({ path, rest, fallback }) => {
  app.get(path, async (req, res) => {
    const domain = req.headers['x-shopify-domain'];
    const reqToken = req.headers['x-shopify-token'];
    if (!domain || !reqToken) return res.status(400).json({ error: 'Missing headers' });
    const token = await getValidToken(domain, reqToken);
    try {
      return res.json(await shopifyRest(domain, token, rest));
    } catch (err) {
      console.warn(`${path} failed:`, err.message);
      return res.status(200).json(fallback);
    }
  });
});

// ── REST: blog articles (needs nested fetch) ─────────────────────────────────
app.get('/api/shopify/articles', async (req, res) => {
  const domain = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!domain || !reqToken) return res.status(400).json({ error: 'Missing headers' });
  const token = await getValidToken(domain, reqToken);
  try {
    const blogsData = await shopifyRest(domain, token, 'blogs.json');
    const blogs = blogsData?.blogs || [];
    const articlesByBlog = await Promise.all(
      blogs.map(async (blog) => {
        try {
          const artData = await shopifyRest(domain, token, `blogs/${blog.id}/articles.json?limit=50`);
          return { blog_title: blog.title, blog_handle: blog.handle, articles: artData?.articles || [] };
        } catch {
          return { blog_title: blog.title, blog_handle: blog.handle, articles: [] };
        }
      })
    );
    return res.json({ blogs: articlesByBlog });
  } catch (err) {
    console.warn('Articles fetch failed:', err.message);
    return res.status(200).json({ blogs: [] });
  }
});

// ── REST: discount codes (nested: price rules → codes) ───────────────────────
app.get('/api/shopify/discounts', async (req, res) => {
  const domain = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!domain || !reqToken) return res.status(400).json({ error: 'Missing headers' });
  const token = await getValidToken(domain, reqToken);
  try {
    const prData = await shopifyRest(domain, token, 'price_rules.json');
    const priceRules = prData?.price_rules || [];
    const discounts = await Promise.all(
      priceRules.map(async (rule) => {
        let codes = [];
        try {
          const codeData = await shopifyRest(domain, token, `price_rules/${rule.id}/discount_codes.json`);
          codes = (codeData?.discount_codes || []).map(c => c.code);
        } catch {}
        return {
          id: rule.id, title: rule.title, value: rule.value,
          value_type: rule.value_type, target_type: rule.target_type,
          allocation_method: rule.allocation_method,
          starts_at: rule.starts_at, ends_at: rule.ends_at,
          usage_limit: rule.usage_limit, codes,
        };
      })
    );
    return res.json({ discounts });
  } catch (err) {
    console.warn('Discounts fetch failed:', err.message);
    return res.status(200).json({ discounts: [] });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ██  AI ROUTES — GEO ANALYST + GEMMA DEEP ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

// ── Full Store GEO Audit (Gemini 2.5 Flash) ──────────────────────────────────
app.post('/api/audit/store', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { shop, storeData } = req.body;
  if (!shop || !storeData) return res.status(400).json({ error: 'Missing shop or storeData' });

  // ── Prepare data — keep full detail, budget = 250k tokens ──
  const trimmed = {
    store: storeData.store_context || {},
    collections: (storeData.collections || []).map(c => ({ title: c.title, description: (c.description || '').slice(0, 300), products_count: c.products_count })),
    products: (storeData.catalog || []).slice(0, 50).map(p => ({
      title: p.title, handle: p.handle, status: p.status,
      description: (p.description || '').slice(0, 500),
      vendor: p.vendor, product_type: p.product_type,
      tags: p.tags, total_inventory: p.total_inventory,
      variants: (p.variants || []).map(v => ({ title: v.title, price: v.price, compare_at_price: v.compare_at_price, sku: v.sku, inventory: v.inventory })),
      images_count: (p.images || []).length,
      has_alt_text: (p.images || []).every(img => img.altText && img.altText.length > 0),
    })),
    discounts: (storeData.discounts || []).map(d => ({ title: d.title, value: d.value, value_type: d.value_type, starts_at: d.starts_at, ends_at: d.ends_at })),
    blog_count: (storeData.blog_content || []).length,
    redirects_count: (storeData.redirects || []).length,
  };

  const storePayload = JSON.stringify(trimmed);
  const estimatedTokens = Math.ceil(storePayload.length / 4);
  console.log(`📊 GEO audit payload: ${storePayload.length} chars (~${estimatedTokens} tokens)`);

  if (estimatedTokens > 200000) {
    console.warn('⚠️ Payload exceeds 200k tokens, truncating products to 30');
    trimmed.products = trimmed.products.slice(0, 30);
  }

  const systemPrompt = `# SYSTEM ROLE & TASK
You are an elite Generative Engine Optimization (GEO) Analyst specializing in ecommerce. Your tone is authoritative, data-backed, and executive.

Your task is to analyze the provided Shopify store JSON payload (products, reviews, metadata, policies, etc.) and produce a comprehensive Store Context Profile followed by a prioritized GEO improvement plan based on the following 10 principles.

### GEO PRINCIPLES
1. Third-Party Authority: AI favors Earned Media (reviews, expert mentions) over brand-owned content. Analyze if content is "citation-ready."
2. AI Answer Visibility: Aim for inclusion *inside* the AI response. Success is measured by word count contribution and citation frequency.
3. Justifiability: AI is a Decision Engine. Content must provide reasons *why* (e.g., "Best for X because Y").
4. Structured Data: Use JSON-LD (Product, FAQ, Organization) to treat the store as an API for AI.
5. High-Impact Strategies:
   * Stats (+30-40% visibility): Use quantitative data.
   * Citations (+30-40%): Reference studies/certifications.
   * Quotes (+25-35%): Customer/expert testimonials.
   * Fluency (+15-30%): Scannable, clear prose.
6. Engine-Specific Needs: GPT (Authority), Gemini (Structured/Concise), Perplexity (Citations).
7. Full Journey: Content must cover Awareness (guides), Consideration (vs. pages), Decision (pricing/trust), and Post-purchase (care).
8. GEO Defense: Build a moat of structured, high-authority content to prevent competitors from displacing your AI citations.
9. The Equalizer: GEO offers a +115% boost for lower-ranked sites; quality beats brand size.
10. AI Readability: Focus on semantic clarity and "extraction readiness" over keyword density.

### ANALYSIS FRAMEWORK
LAYER 1: Store-Level Health Score (0-100)
 * Schema (20%): Completeness of JSON-LD.
 * Content Quality (20%): Depth, stats, and use-case targeting.
 * Trust (15%): Review quality and expert signals.
 * Extractability (15%): Scannability and Q&A formats.
 * Journey/Policy (20%): Funnel coverage and shipping/returns clarity.
 * Cross-Engine (10%): Optimization for different AI types.

LAYER 2: Product Deep-Dive
 * Description Score: Check for Statistics Density (min. 5 per product), Citation Readiness, and "Justification Fragments" (e.g., "Ideal for...").
 * Metadata: Evaluate Title [Brand+Type+Feature], Tags, Metafields, and Alt Text.
 * AI Recommendation Readiness: "Cold Start Score" (can AI recommend this with zero user data?).

LAYER 3: Gap Analysis
 * Content Gaps: Missing FAQs, "How-to" guides, or "X vs Y" comparisons.
 * Trust Gaps: Missing aggregate ratings or certifications in structured data.

LAYER 4: Competitive Positioning
 * Map specific natural-language queries (e.g., "Best [category] for [use-case]") to products. Identify items at risk of being skipped.

### STRICT GUIDELINES & FAIL-SAFES
 * No Generic Advice: Every tip MUST reference specific keys, values, or strings from the provided JSON data.
 * Missing Data Protocol: If specific JSON fields (like reviews, schema, or policies) are completely missing, explicitly state "DATA MISSING" and score that section a 0. Do not guess or hallucinate data.
 * Quantify: Use the principle percentages (e.g., "Adding these 3 stats will boost visibility by ~30%").
 * AI-First Mindset: Ask: "Would an AI agent cite this product as a top 3 choice based on this data?"

OUTPUT STRICTLY IN VALID JSON. Required schema:
{
  "storeContextSynthesis": "<~400 word narrative: store identity, target demographic, product categories, price positioning, value props, and core policies (shipping, returns, terms). This is a SYSTEM-ONLY field.>",
  "executiveSummary": {
    "geoHealthScore": <number 0-100>,
    "grade": "<A|B|C|D|F>",
    "topThreat": "<single sentence: why AI skips this store>",
    "topOpportunity": "<single sentence: quickest win>"
  },
  "layerScores": {
    "schema":         { "score": <0-20>, "details": "<specific evidence>" },
    "contentQuality": { "score": <0-20>, "details": "<specific evidence>" },
    "trust":          { "score": <0-15>, "details": "<specific evidence>" },
    "extractability": { "score": <0-15>, "details": "<specific evidence>" },
    "journeyPolicy":  { "score": <0-20>, "details": "<specific evidence>" },
    "crossEngine":    { "score": <0-10>, "details": "<specific evidence>" }
  },
  "productAnalysis": {
    "topPerformers":    [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }],
    "bottomPerformers": [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }]
  },
  "actionPlan": {
    "critical": [{ "title": "<action>", "principle": "<GEO principle #>", "what": "<specific change>", "why": "<which principle & expected impact>", "how": "<before → after example using actual store data>", "impact": "HIGH" }],
    "highPriority": [{ "title": "<action>", "principle": "<GEO principle #>", "what": "<specific change>", "why": "<which principle & expected impact>", "how": "<before → after example>", "impact": "MEDIUM" }],
    "strategic": [{ "title": "<action>", "principle": "<GEO principle #>", "what": "<specific change>", "why": "<which principle & expected impact>", "how": "<before → after example>", "impact": "HIGH" }]
  },
  "projectedImpact": {
    "estimatedVisibilityIncrease": "<e.g. +45-65%>",
    "timeline": "<e.g. 2-4 weeks for critical, 1-2 months for high priority>"
  }
}`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nStore Data:\n' + JSON.stringify(trimmed) }] },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32768,
        responseMimeType: "application/json"
      },
    });

    const geminiRes = await httpsRequest(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);

    const data = geminiRes.json();
    if (!geminiRes.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      console.error(`Gemini GEO audit error (${geminiRes.status}):`, errMsg);
      return res.status(geminiRes.status).json({ error: `Gemini API error: ${errMsg}` });
    }

    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) return res.status(500).json({ error: 'Gemini returned empty audit' });

    let audit;
    try {
      audit = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse GEO audit:', rawText.slice(0, 500));
      return res.status(500).json({ error: 'GEO audit response was malformed' });
    }

    // ── Save storeContextSynthesis as internal policy (replaces old global policy) ──
    if (audit.storeContextSynthesis) {
      policyStore.set(shop, { policy: audit.storeContextSynthesis, generatedAt: Date.now() });
      console.log(`🧠 Store Context Synthesis saved for ${shop} (${audit.storeContextSynthesis.length} chars)`);
    }

    // ── CRITICAL: Strip storeContextSynthesis before sending to frontend ──
    const { storeContextSynthesis, ...frontendAudit } = audit;

    console.log(`✅ GEO audit complete: score=${frontendAudit.executiveSummary?.geoHealthScore}, grade=${frontendAudit.executiveSummary?.grade}`);
    return res.json(frontendAudit);
  } catch (err) {
    console.error('GEO audit error:', err.message);
    return res.status(500).json({ error: 'GEO audit failed: ' + err.message });
  }
});
// ── Deep Product Analysis (Gemma 4 31B via Gemini API) ───────────────────────
app.post('/api/audit/product', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { shop, product } = req.body;
  if (!shop || !product) return res.status(400).json({ error: 'Missing shop or product' });

  const stored = policyStore.get(shop);
  if (!stored) return res.status(400).json({ error: 'Store context not available. Run a GEO audit first.' });

  const prompt = `You are an elite Shopify compliance auditor.
You will be provided with a Global Store Policy and a specific Product's data.
Your job is to find contradictions, legal risks, missing content, SEO issues, pricing errors, or marketing violations.

Be thorough — check descriptions, tags, pricing vs compare_at_price, inventory, images/alt text, and policy alignment.

OUTPUT STRICTLY IN VALID JSON. Required schema:
{
  "riskLevel": "HIGH" | "MEDIUM" | "LOW" | "SAFE",
  "overallScore": <number 0-100>,
  "issues": ["<specific issue with evidence>"],
  "suggestions": ["<actionable fix>"],
  "seoScore": <number 0-100>,
  "complianceScore": <number 0-100>,
  "contentScore": <number 0-100>
}

Global Store Policy:
${stored.policy}

Product Data:
${JSON.stringify(product, null, 2)}`;

  try {
    const gemmaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${GEMINI_API_KEY}`;
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      },
    });

    const gemmaRes = await httpsRequest(gemmaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);

    const data = gemmaRes.json();
    if (!gemmaRes.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      console.error(`Gemma 4 error (${gemmaRes.status}):`, errMsg);
      return res.status(gemmaRes.status).json({ error: `Gemma API error: ${errMsg}` });
    }

    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) return res.status(500).json({ error: 'Gemma returned empty response' });

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      console.error('Failed to parse Gemma 4 response:', rawText.slice(0, 500));
      analysis = {
        riskLevel: 'MEDIUM', overallScore: 50,
        issues: ['Model returned unparseable output.'],
        suggestions: ['Try running the analysis again.'],
        seoScore: 50, complianceScore: 50, contentScore: 50,
      };
    }

    console.log(`🔬 Deep analysis for "${product.title}" → ${analysis.riskLevel} (score: ${analysis.overallScore})`);
    return res.json(analysis);
  } catch (err) {
    console.error('Gemma 4 audit error:', err.message);
    return res.status(500).json({ error: 'Product analysis failed: ' + err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ██  SHOPIFY OAuth 2.0
// ══════════════════════════════════════════════════════════════════════════════

// ── Install Route — Redirect merchant to Shopify consent screen ──────────────
app.get('/api/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing ?shop= parameter' });

  const nonce = crypto.randomBytes(16).toString('hex');
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${SHOPIFY_CLIENT_ID}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${SHOPIFY_APP_URL}/api/auth/callback` +
    `&state=${nonce}`;

  console.log(`🔐 OAuth → ${shop}`);
  return res.redirect(authUrl);
});

// ── Callback Route — Validate HMAC, exchange code for token ──────────────────
app.get('/api/auth/callback', async (req, res) => {
  try {
    const { hmac, shop, code, state, ...rest } = req.query;
    if (!hmac || !shop || !code) {
      return res.status(400).json({ error: 'Missing callback params (hmac, shop, code)' });
    }

    // HMAC validation — verify request is from Shopify
    const queryParams = { shop, code, state, ...rest };
    const message = Object.keys(queryParams).sort().map(k => `${k}=${queryParams[k]}`).join('&');
    const generatedHmac = crypto.createHmac('sha256', SHOPIFY_CLIENT_SECRET).update(message).digest('hex');
    const hmacBuffer   = Buffer.from(hmac, 'hex');
    const digestBuffer = Buffer.from(generatedHmac, 'hex');

    if (hmacBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(hmacBuffer, digestBuffer)) {
      console.error('❌ HMAC validation FAILED');
      return res.status(403).json({ error: 'HMAC validation failed' });
    }
    console.log('✅ HMAC validated');

    // Exchange auth code for access token
    const tokenPayload = JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
      expiring: 1, // <--- CRITICAL: Requests an expiring offline token instead of a legacy non-expiring one
    });
    const tokenRes = await httpsRequest(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(tokenPayload),
      },
    }, tokenPayload);

    const tokenData = tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('❌ Token exchange failed:', JSON.stringify(tokenData, null, 2));
      return res.status(500).json({ error: 'Token exchange failed', detail: tokenData });
    }

    tokenStore.set(shop, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000)
    });
    console.log(`🔑 Token & Refresh Token obtained for ${shop}`);

    // Redirect to the app root (which will inject the token and load the Vite app)
    // We pass along the host parameter which is required by Shopify App Bridge
    const host = req.query.host;
    return res.redirect(`/?shop=${shop}${host ? `&host=${host}` : ''}`);

  } catch (err) {
    console.error('💥 OAuth callback error:', err);
    return res.status(500).json({ error: 'OAuth callback failed', message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ██  VITE PROXY & SERVER START
// ══════════════════════════════════════════════════════════════════════════════

// Catch-all: proxy everything else to Vite dev server (MUST be last)
app.use('/', createProxyMiddleware({
  target: 'http://localhost:5173',
  changeOrigin: true,
  ws: true,
  logLevel: 'silent',
}));

app.listen(PORT, () => {
  console.log(`✅ Proxy running at http://localhost:${PORT}`);
  console.log(`🌐 Vite frontend proxied through Express`);
  if (SHOPIFY_CLIENT_ID && SHOPIFY_APP_URL) {
    console.log(`🔐 Install: ${SHOPIFY_APP_URL}/install`);
  } else {
    console.log('⚠️  OAuth disabled — set env vars in .env.local');
  }
});
