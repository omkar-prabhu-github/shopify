import express from 'express';
import { runGeoAudit } from '../services/ai/gemini.js';
import { runProductAnalysis } from '../services/ai/gemma.js';
import { fetchInternalStoreData } from '../services/shopify/data.js';

const router = express.Router();

router.post('/store', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing or unauthorized session tokens' });

  try {
    // SECURITY PATCH: Do NOT accept request bodies from clients (Data Forgery)
    // Always fetch data natively on the backend via admin tokens
    const storeData = await fetchInternalStoreData(shop, reqToken);
    
    if (!storeData || !storeData.catalog) throw new Error('Secure data fetch failed');

    const frontendAudit = await runGeoAudit(shop, storeData);
    console.log(`✅ GEO audit complete: score=${frontendAudit.executiveSummary?.geoHealthScore}, grade=${frontendAudit.executiveSummary?.grade}`);
    return res.json(frontendAudit);
  } catch (err) {
    console.error('GEO audit error:', err.message);
    return res.status(500).json({ error: 'GEO audit failed: ' + err.message });
  }
});

router.post('/product', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  const { product } = req.body;

  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing or unauthorized session tokens' });
  if (!product) return res.status(400).json({ error: 'Missing product payload' });

  try {
    // Add token validation check
    const { getValidToken } = await import('../services/shopify/rest.js');
    await getValidToken(shop, reqToken);

    const analysis = await runProductAnalysis(shop, product);
    console.log(`🔬 Deep analysis for "${product.title}" → ${analysis.riskLevel} (score: ${analysis.overallScore})`);
    return res.json(analysis);
  } catch (err) {
    console.error('Product analysis error:', err.message);
    return res.status(500).json({ error: 'Product analysis failed: ' + err.message });
  }
});

export default router;
