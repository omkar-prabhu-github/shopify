import express from 'express';
import { getValidToken, normalizeDomain, shopifyRest, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

// GraphQL proxy
router.post('/', async (req, res) => {
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

// REST proxy routes
const restRoutes = [
  { path: '/shop',            rest: 'shop.json',                     fallback: { shop: {} } },
  { path: '/policies',        rest: 'policies.json',                 fallback: { policies: [] } },
  { path: '/customers-count', rest: 'customers/count.json',          fallback: { count: 0 } },
  { path: '/orders-count',    rest: 'orders/count.json?status=any',  fallback: { count: 0 } },
  { path: '/redirects',       rest: 'redirects.json?limit=250',      fallback: { redirects: [] } },
];

restRoutes.forEach(({ path, rest, fallback }) => {
  router.get(path, async (req, res) => {
    const domain = req.headers['x-shopify-domain'];
    const reqToken = req.headers['x-shopify-token'];
    if (!domain || !reqToken) return res.status(400).json({ error: 'Missing headers' });
    const token = await getValidToken(domain, reqToken);
    try {
      return res.json(await shopifyRest(domain, token, rest));
    } catch (err) {
      console.warn(`[Shopify Proxy] ${path} failed:`, err.message);
      return res.status(200).json(fallback);
    }
  });
});

// REST: blog articles
router.get('/articles', async (req, res) => {
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

// REST: discount codes
router.get('/discounts', async (req, res) => {
  const domain = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!domain || !reqToken) return res.status(400).json({ error: 'Missing headers' });
  const token = await getValidToken(domain, reqToken);
  try {
    const prData = await shopifyRest(domain, token, 'price_rules.json');
    const discounts = (prData?.price_rules || []).map((rule) => ({
      id:                rule.id,
      title:             rule.title,
      value:             rule.value,
      value_type:        rule.value_type,
      target_type:       rule.target_type,
      allocation_method: rule.allocation_method,
      starts_at:         rule.starts_at,
      ends_at:           rule.ends_at,
      usage_limit:       rule.usage_limit,
      codes:             [],
    }));
    return res.json({ discounts });
  } catch (err) {
    console.warn('Discounts fetch failed:', err.message);
    return res.status(200).json({ discounts: [] });
  }
});

export default router;
