import { getValidToken, normalizeDomain, shopifyRest, httpsRequest } from './rest.js';

const shopifyQuery = `
query GetStoreData {
  shop {
    name
    primaryDomain { url host }
  }
  pages(first: 20) {
    edges { node { title handle body } }
  }
  collections(first: 50) {
    edges { node { id title handle description image { url altText } productsCount { count } } }
  }
  products(first: 50) {
    edges {
      node {
        id title handle descriptionHtml productType vendor tags status totalInventory
        images(first: 5) { edges { node { url altText } } }
        variants(first: 10) { edges { node { id title price compareAtPrice sku inventoryQuantity availableForSale } } }
        metafields(first: 10) { edges { node { key value namespace } } }
      }
    }
  }
}`;

const stripHtml = (html) => html ? html.replace(/<[^>]+>/g, '').trim() : '';

export async function fetchInternalStoreData(domain, reqToken) {
  const token = await getValidToken(domain, reqToken);
  
  // GraphQL Native fetch
  const gqlEndpoint = `${normalizeDomain(domain)}/admin/api/2023-10/graphql.json`;
  const bodyStr = JSON.stringify({ query: shopifyQuery });
  const gqlRes = await httpsRequest(gqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  }, bodyStr);
  
  const gqlData = gqlRes.ok ? (gqlRes.json().data || {}) : {};

  // REST Native fetches
  const safe = async (restPath) => {
    try { return await shopifyRest(domain, token, restPath); } catch { return {}; }
  };

  const [shopJ, polJ, discJ, custJ, ordJ, redJ] = await Promise.all([
    safe('shop.json'),
    safe('policies.json'),
    safe('price_rules.json'),
    safe('customers/count.json'),
    safe('orders/count.json?status=any'),
    safe('redirects.json?limit=250')
  ]);

  // Blogs & Articles
  let blog_content = [];
  try {
    const blogsData = await safe('blogs.json');
    for (const blog of (blogsData.blogs || [])) {
      const artData = await safe(`blogs/${blog.id}/articles.json?limit=50`);
      (artData.articles || []).forEach(a => {
        blog_content.push({
          blog: blog.title, title: a.title, handle: a.handle, author: a.author,
          tags: a.tags || '', published_at: a.published_at, body: stripHtml(a.body_html || '')
        });
      });
    }
  } catch {}

  // Complex Discounts
  let discounts = [];
  try {
    for (const rule of (discJ.price_rules || [])) {
      let codes = [];
      try {
        const codeData = await safe(`price_rules/${rule.id}/discount_codes.json`);
        codes = (codeData.discount_codes || []).map(c => c.code);
      } catch {}
      discounts.push({
        id: rule.id, title: rule.title, value: rule.value, value_type: rule.value_type,
        target_type: rule.target_type, allocation_method: rule.allocation_method,
        starts_at: rule.starts_at, ends_at: rule.ends_at, usage_limit: rule.usage_limit, codes
      });
    }
  } catch {}

  // Transformer Logic
  const sd = shopJ.shop || {};
  const shop_info = {
    email: sd.email || '', phone: sd.phone || '', currency: sd.currency || '',
    money_format: sd.money_format || '', city: sd.city || '', country: sd.country_name || ''
  };

  const native_policies = {};
  const rawPolicies = polJ.policies || [];
  console.log(`📜 Raw policies from Shopify: ${rawPolicies.length} policies found`);
  rawPolicies.forEach(p => {
    console.log(`  📜 Policy "${p.handle}": title="${p.title}", body_length=${(p.body || '').length}`);
    if (p.handle) native_policies[p.handle] = stripHtml(p.body || '');
  });

  const custom_pages = {};
  (gqlData.pages?.edges || []).forEach(e => { if (e.node.handle) custom_pages[e.node.handle] = stripHtml(e.node.body || ''); });

  const store_context = {
    name: gqlData.shop?.name || '', domain: gqlData.shop?.primaryDomain?.url || '',
    shop_info, stats: { customers_count: custJ.count || 0, orders_count: ordJ.count || 0 },
    native_policies, custom_pages
  };

  const collections = (gqlData.collections?.edges || []).map(e => ({
    id: e.node.id, title: e.node.title, handle: e.node.handle, description: e.node.description || '',
    products_count: e.node.productsCount?.count || 0, image: e.node.image?.url || null
  }));

  const catalog = (gqlData.products?.edges || []).map(e => {
    const n = e.node;
    const metafields = {};
    (n.metafields?.edges || []).forEach(m => { if (m.node.key) metafields[m.node.key] = m.node.value; });
    const images = (n.images?.edges || []).map(i => ({ url: i.node.url, altText: i.node.altText || '' }));
    const variants = (n.variants?.edges || []).map(v => ({
      id: v.node.id, title: v.node.title, price: v.node.price, compare_at_price: v.node.compareAtPrice,
      sku: v.node.sku, inventory: v.node.inventoryQuantity || 0, available: v.node.availableForSale || true
    }));
    return {
      id: n.id, title: n.title, handle: n.handle, description: stripHtml(n.descriptionHtml || ''),
      product_type: n.productType || '', vendor: n.vendor || '', tags: n.tags || [],
      status: n.status || '', total_inventory: n.totalInventory || 0, images, variants, metafields
    };
  });

  const redirects = (redJ.redirects || []).map(r => ({ path: r.path, target: r.target }));

  return { store_context, collections, catalog, discounts, blog_content, redirects };
}
