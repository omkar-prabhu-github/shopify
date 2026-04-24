require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cors    = require('cors');
const https   = require('https');
const crypto  = require('crypto');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = 3000;

// In-memory token store: shop domain → access_token (use a DB in production)
const tokenStore = new Map();

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
      return res.redirect(`/?shop=${shop}&token=${storedToken}`);
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
// ██  HUGGING FACE INFERENCE PROXY
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/huggingface', async (req, res) => {
  const token    = req.headers['x-hf-token'];
  const provider = req.headers['x-hf-provider'] || 'novita';
  const modelId  = req.headers['x-hf-model']    || 'qwen/qwen-2.5-72b-instruct';
  if (!token) return res.status(400).json({ error: 'Missing x-hf-token header' });

  const HF_URL = `https://router.huggingface.co/${provider}/v1/chat/completions`;
  try {
    const payload = { model: modelId, ...req.body };
    const bodyStr = JSON.stringify(payload);
    const parsed = new URL(HF_URL);
    const hfRes = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: parsed.hostname, path: parsed.pathname,
        port: 443, method: 'POST', family: 4, timeout: 120000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try { resolve({ status: response.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: response.statusCode, body: data }); }
        });
      });
      r.on('timeout', () => { r.destroy(); reject(new Error('HF request timed out after 120s')); });
      r.on('error', reject);
      r.write(bodyStr);
      r.end();
    });
    return res.status(hfRes.status).json(hfRes.body);
  } catch (err) {
    console.error(`HF proxy error [${provider}/${modelId}]:`, err.message);
    return res.status(500).json({ error: err.message });
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

    // Redirect to the app inside Shopify admin
    return res.redirect(`https://${shop}/admin/apps/${SHOPIFY_CLIENT_ID}`);

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
