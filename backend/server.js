import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Routes
import authRouter from './routes/auth.js';
import shopifyProxyRouter from './routes/shopify-proxy.js';
import aiAuditRouter from './routes/ai-audit.js';
import fixRouter from './routes/fix.js';
import blogRouter from './routes/blog.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Allow Shopify iframe
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors https://*.myshopify.com https://admin.shopify.com");
  next();
});

// Root route
import { tokenStore } from './store.js';

app.get('/', (req, res, next) => {
  const { shop, token } = req.query;
  // If we have both shop and token in URL, pass through to Vite
  if (shop && token) return next();

  if (shop) {
    // Check if we already have a stored token for this shop
    const stored = tokenStore.get(shop);
    if (stored && stored.accessToken) {
      // Token exists — let Vite serve the React app (it'll fetch session from /api/auth/session)
      return next();
    }
    // No token stored — start OAuth flow
    return res.redirect(`/api/auth?shop=${shop}`);
  }
  next();
});

app.get('/install', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Install Axiom</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #fff; text-align: center; }
    input { padding: 10px; border-radius: 4px; border: 1px solid #ccc; width: 250px; }
    button { padding: 10px 20px; background: #22c55e; border: none; border-radius: 4px; color: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <div>
    <h1>Install Axiom</h1>
    <form onsubmit="event.preventDefault(); window.location.href = '/api/auth?shop=' + document.getElementById('shop').value + '.myshopify.com'">
      <input id="shop" type="text" placeholder="mystore" required />
      <button type="submit">Install</button>
    </form>
  </div>
</body>
</html>`);
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/shopify', shopifyProxyRouter);
app.use('/api/audit', aiAuditRouter);
app.use('/api/fix', fixRouter);
app.use('/api/blog', blogRouter);

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Catch-all Vite Proxy for local development
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true,
    logLevel: 'silent',
  }));
}

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
