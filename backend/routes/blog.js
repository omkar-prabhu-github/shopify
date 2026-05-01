import express from 'express';
import { runBlogAnalysis, runBlogGeneration } from '../services/ai/gemma.js';
import { getValidToken, normalizeDomain, shopifyRest, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

// POST /api/blog/analyze — analyze an existing blog article via Gemma 4
router.post('/analyze', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { article } = req.body;
  if (!article || !article.title) {
    return res.status(400).json({ error: 'Missing article data' });
  }

  try {
    console.log(`📝 Blog analysis requested: "${article.title}"`);
    const analysis = await runBlogAnalysis(shop, article);
    return res.json({ ok: true, analysis });
  } catch (err) {
    console.error('Blog analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/blog/generate — generate a new blog article via Gemma 4 & publish to Shopify
router.post('/generate', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { topic, blogId } = req.body;
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  const token = await getValidToken(shop, reqToken);

  try {
    // Step 1: Generate blog content via Gemma 4
    console.log(`✍️ Generating blog: "${topic}" for ${shop}`);
    const generated = await runBlogGeneration(shop, topic);

    // Step 2: If blogId provided, publish to Shopify
    if (blogId) {
      try {
        const articlePayload = JSON.stringify({
          article: {
            title: generated.title,
            body_html: generated.bodyHtml,
            tags: (generated.tags || []).join(', '),
            published: true, // Publish directly
          },
        });

        const createUrl = `${normalizeDomain(shop)}/admin/api/2024-10/blogs/${blogId}/articles.json`;
        const createRes = await httpsRequest(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
            'Content-Length': Buffer.byteLength(articlePayload),
          },
        }, articlePayload);

        const result = createRes.json();
        if (!createRes.ok) {
          throw new Error(result?.errors ? JSON.stringify(result.errors) : `HTTP ${createRes.status}`);
        }

        console.log(`✅ Blog article created as draft: "${generated.title}"`);
        return res.json({
          ok: true,
          generated,
          published: true,
          article: result?.article || null,
        });
      } catch (pubErr) {
        console.warn(`⚠️ Blog generated but publish failed:`, pubErr.message);
        return res.json({
          ok: true,
          generated,
          published: false,
          publishError: pubErr.message,
        });
      }
    }

    // No blogId — return generated content only (preview mode)
    return res.json({ ok: true, generated, published: false });
  } catch (err) {
    console.error('Blog generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/blog/list — list all blogs (so frontend knows which blog to publish to)
router.get('/list', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const token = await getValidToken(shop, reqToken);
  try {
    const data = await shopifyRest(shop, token, 'blogs.json');
    const blogs = (data?.blogs || []).map(b => ({ id: b.id, title: b.title, handle: b.handle }));
    return res.json({ blogs });
  } catch (err) {
    console.warn('Blog list failed:', err.message);
    return res.json({ blogs: [] });
  }
});

// POST /api/blog/publish — publish already-generated content (no AI call)
router.post('/publish', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { blogId, title, bodyHtml, tags } = req.body;
  if (!blogId || !title || !bodyHtml) return res.status(400).json({ error: 'Missing required fields' });

  const token = await getValidToken(shop, reqToken);

  try {
    const articlePayload = JSON.stringify({
      article: {
        title,
        body_html: bodyHtml,
        tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
        published: true,
      },
    });

    const createUrl = `${normalizeDomain(shop)}/admin/api/2024-10/blogs/${blogId}/articles.json`;
    const createRes = await httpsRequest(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(articlePayload),
      },
    }, articlePayload);

    const result = createRes.json();
    if (!createRes.ok) {
      throw new Error(result?.errors ? JSON.stringify(result.errors) : `HTTP ${createRes.status}`);
    }

    console.log(`✅ Blog published: "${title}"`);
    return res.json({ ok: true, published: true, article: result?.article || null });
  } catch (err) {
    console.error('Blog publish error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
