import https from 'https';
import { tokenStore } from '../../store.js';

const agent = new https.Agent({ keepAlive: true, maxSockets: 25 });

export function normalizeDomain(domain) {
  let d = domain;
  if (!d.includes('.')) d = `${d}.myshopify.com`;
  if (!d.startsWith('http')) d = `https://${d}`;
  return d;
}

export function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      port:     443,
      method:   options.method || 'GET',
      headers:  options.headers || {},
      family:   4,
      timeout:  120000,
      agent,
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out after 120s')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function shopifyRest(domain, token, path) {
  const url = `${normalizeDomain(domain)}/admin/api/2023-10/${path}`;
  const res = await httpsRequest(url, {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': token },
  });
  if (!res.ok) throw new Error(`REST ${path} failed: ${res.status}`);
  return res.json();
}

export async function getValidToken(domain, fallbackToken) {
  const shop = normalizeDomain(domain).replace('https://', '');
  const data = tokenStore.get(shop);

  if (!data) return fallbackToken;
  if (typeof data === 'string') return data;

  const { accessToken, refreshToken, expiresAt } = data;

  if (Date.now() < expiresAt - 60000) return accessToken;

  console.log(`🔄 Token expired for ${shop}, refreshing...`);
  try {
    const payload = JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
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
