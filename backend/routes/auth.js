import express from 'express';
import crypto from 'crypto';
import { tokenStore } from '../store.js';
import { httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

const SCOPES = 'read_products,write_products,read_content,read_customers,read_orders,read_inventory,read_discounts,read_price_rules,read_online_store_pages,read_online_store_navigation';

router.get('/', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing ?shop= parameter' });

  const nonce = crypto.randomBytes(16).toString('hex');
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_CLIENT_ID}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${process.env.SHOPIFY_APP_URL}/api/auth/callback` +
    `&state=${nonce}`;

  console.log(`🔐 OAuth → ${shop}`);
  return res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { hmac, shop, code, state, ...rest } = req.query;
    if (!hmac || !shop || !code) {
      return res.status(400).json({ error: 'Missing callback params (hmac, shop, code)' });
    }

    const queryParams = { shop, code, state, ...rest };
    const message = Object.keys(queryParams).sort().map(k => `${k}=${queryParams[k]}`).join('&');
    const generatedHmac = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update(message).digest('hex');
    const hmacBuffer   = Buffer.from(hmac, 'hex');
    const digestBuffer = Buffer.from(generatedHmac, 'hex');

    if (hmacBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(hmacBuffer, digestBuffer)) {
      console.error('❌ HMAC validation FAILED');
      return res.status(403).json({ error: 'HMAC validation failed' });
    }
    console.log('✅ HMAC validated');

    const tokenPayload = JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
      expiring: 1,
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

    const host = req.query.host;
    return res.redirect(`/?shop=${shop}${host ? `&host=${host}` : ''}`);

  } catch (err) {
    console.error('💥 OAuth callback error:', err);
    return res.status(500).json({ error: 'OAuth callback failed', message: err.message });
  }
});

export default router;
