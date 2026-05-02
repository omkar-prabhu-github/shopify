import express from 'express';
import { getValidToken, normalizeDomain, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

const MUTATIONS = {
  product_title: {
    query: `mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id title } userErrors { field message } } }`,
    buildVars: (id, val) => ({ product: { id, title: val } }),
  },
  product_description: {
    query: `mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id descriptionHtml } userErrors { field message } } }`,
    buildVars: (id, val) => ({ product: { id, descriptionHtml: val } }),
  },
  product_tags: {
    query: `mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id tags } userErrors { field message } } }`,
    buildVars: (id, val) => ({ product: { id, tags: Array.isArray(val) ? val : val.split(',').map(t => t.trim()) } }),
  },
  product_metafield: {
    query: `mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id key value } userErrors { field message } } }`,
    buildVars: (id, val, extra) => ({
      metafields: [{
        ownerId: id,
        namespace: extra?.namespace || 'custom',
        key: extra?.key || 'seo_data',
        value: val,
        type: extra?.metafieldType || 'single_line_text_field',
      }],
    }),
  },
  page_create: {
    query: `mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id title body } userErrors { field message } } }`,
    buildVars: (_id, val, extra) => ({ page: { title: extra?.title || 'New Page', body: val, isPublished: true } }),
  },
  page_content: {
    query: `mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id title body } userErrors { field message } } }`,
    buildVars: (id, val) => ({ id, page: { body: val } }),
    // Fallback: if page doesn't exist, create it instead
    fallbackType: 'page_create',
  },
  page_title: {
    query: `mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id title } userErrors { field message } } }`,
    buildVars: (id, val) => ({ id, page: { title: val } }),
  },
  collection_description: {
    query: `mutation($input: CollectionInput!) { collectionUpdate(input: $input) { collection { id description } userErrors { field message } } }`,
    buildVars: (id, val) => ({ input: { id, descriptionHtml: val } }),
  },
  article_title: {
    query: `mutation($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { id title } userErrors { field message } } }`,
    buildVars: (id, val) => ({ id, article: { title: val } }),
  },
  article_body: {
    query: `mutation($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { id body } userErrors { field message } } }`,
    buildVars: (id, val) => ({ id, article: { body: val } }),
  },
  article_tags: {
    query: `mutation($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { id tags } userErrors { field message } } }`,
    buildVars: (id, val) => ({ id, article: { tags: Array.isArray(val) ? val : val.split(',').map(t => t.trim()) } }),
  },
};

// Resolve handle/slug to a proper Shopify GID if needed
async function resolveResourceId(resourceId, type, endpoint, token, resourceTitle) {
  // No resourceId at all (e.g., page_create)
  if (!resourceId) return resourceId;

  let handle = resourceId.trim();

  // Check if it's a GID — but also check if it's a FAKE GID with a handle instead of a numeric ID
  if (handle.startsWith('gid://')) {
    const lastPart = handle.split('/').pop();
    // Real GIDs have numeric IDs; fake ones have handles like "the-complete-snowboard"
    if (/^\d+$/.test(lastPart)) {
      return handle; // Valid numeric GID — return as-is
    }
    // Extract the handle from the fake GID
    console.log(`⚠️ Fake GID detected: "${handle}" — extracting handle "${lastPart}"`);
    handle = lastPart;
  }

  // Helper to run a GraphQL query and extract the GID
  async function tryQuery(gqlQuery, extractor, label) {
    try {
      const bodyStr = JSON.stringify({ query: gqlQuery });
      const res = await httpsRequest(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, bodyStr);
      const data = res.json();
      console.log(`🔍 ${label}:`, JSON.stringify(data?.data || data?.errors));
      return extractor(data);
    } catch (err) {
      console.warn(`⚠️ Query failed (${label}):`, err.message);
      return null;
    }
  }

  let gid = null;

  // For articles, use a different search approach since there's no top-level 'articles' query
  if (type.startsWith('article')) {
    // If handle is numeric, construct the GID directly
    if (/^\d+$/.test(handle)) {
      gid = `gid://shopify/Article/${handle}`;
      console.log(`✅ Constructed article GID from numeric ID: ${gid}`);
      return gid;
    }

    // Search articles by title across all blogs
    if (resourceTitle) {
      const escapedTitle = resourceTitle.replace(/"/g, '\\"');
      gid = await tryQuery(
        `{ articles(first: 5, query: "title:${escapedTitle}") { nodes { id title } } }`,
        (d) => d?.data?.articles?.nodes?.[0]?.id,
        `Article title search "${resourceTitle}"`
      );
      if (gid) { console.log(`✅ Resolved article "${resourceTitle}" → ${gid}`); return gid; }
    }

    console.warn(`⚠️ Could not resolve article "${resourceId}"`);
    return resourceId;
  }

  const resourceType = type.startsWith('product') ? 'products' : type.startsWith('collection') ? 'collections' : 'pages';

  // If handle is purely numeric, wrap it in a GID
  if (/^\d+$/.test(handle)) {
    const Type = type.startsWith('product') ? 'Product' : type.startsWith('collection') ? 'Collection' : 'Page';
    gid = `gid://shopify/${Type}/${handle}`;
    console.log(`✅ Constructed GID from numeric ID: ${gid}`);
    return gid;
  }

  // Attempt 1: Search by handle (useful if AI gives a slug)
  const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  gid = await tryQuery(
    `{ ${resourceType}(first: 1, query: "handle:${cleanHandle}") { nodes { id } } }`,
    (d) => d?.data?.[resourceType]?.nodes?.[0]?.id,
    `Handle search "${cleanHandle}"`
  );
  if (gid) { console.log(`✅ Resolved handle "${cleanHandle}" → ${gid}`); return gid; }

  // Attempt 2: Search by title (AI often passes the title as resourceId or resourceTitle)
  const searchTitle = resourceTitle || handle; // Fallback to handle since AI might put title there
  if (searchTitle) {
    // Escape quotes for GraphQL
    const escapedTitle = searchTitle.replace(/"/g, '\\"');
    gid = await tryQuery(
      `{ ${resourceType}(first: 1, query: "title:\\"${escapedTitle}\\"") { nodes { id } } }`,
      (d) => d?.data?.[resourceType]?.nodes?.[0]?.id,
      `Title search "${searchTitle}"`
    );
    if (gid) { console.log(`✅ Resolved by title "${searchTitle}" → ${gid}`); return gid; }
  }

  console.warn(`⚠️ Could not resolve "${resourceId}" for type ${type}`);
  return resourceId; // Return original as fallback
}

async function executeMutation(mutationDef, resourceId, newValue, extra, endpoint, token) {
  const variables = mutationDef.buildVars(resourceId, newValue, extra);
  const bodyStr = JSON.stringify({ query: mutationDef.query, variables });

  const gqlRes = await httpsRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  }, bodyStr);

  const data = gqlRes.json();
  const mutationKey = Object.keys(data.data || {})[0];
  const userErrors = data.data?.[mutationKey]?.userErrors || [];

  return { ok: gqlRes.ok, status: gqlRes.status, data, mutationKey, userErrors };
}

router.post('/apply', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const token = await getValidToken(shop, reqToken);
  const { type, resourceId: rawResourceId, newValue, extra, resourceTitle } = req.body;
  const resourceId = String(rawResourceId || '');

  if (!type || newValue === undefined) {
    return res.status(400).json({ error: 'Missing required fields: type, newValue' });
  }

  // ── Special case: shop_policy — use GraphQL shopPolicyUpdate mutation ──
  if (type === 'shop_policy') {
    try {
      const policyType = req.body.extra?.policyType || resourceId || 'refund_policy';
      // Map snake_case handle to Shopify's SCREAMING_SNAKE ShopPolicyType enum
      const POLICY_TYPE_MAP = {
        'refund_policy': 'REFUND_POLICY',
        'privacy_policy': 'PRIVACY_POLICY',
        'terms_of_service': 'TERMS_OF_SERVICE',
        'shipping_policy': 'SHIPPING_POLICY',
        'subscription_policy': 'SUBSCRIPTION_POLICY',
        'contact_information': 'CONTACT_INFORMATION',
        'legal_notice': 'LEGAL_NOTICE',
      };
      const shopifyPolicyType = POLICY_TYPE_MAP[policyType] || policyType.toUpperCase();
      console.log(`📜 Updating policy: ${policyType} → ${shopifyPolicyType} via GraphQL`);

      const domain = normalizeDomain(shop);
      const mutation = `mutation shopPolicyUpdate($shopPolicy: ShopPolicyInput!) {
        shopPolicyUpdate(shopPolicy: $shopPolicy) {
          shopPolicy { id body type }
          userErrors { field message }
        }
      }`;
      const variables = {
        shopPolicy: {
          type: shopifyPolicyType,
          body: newValue,
        },
      };
      const bodyStr = JSON.stringify({ query: mutation, variables });
      const gqlRes = await httpsRequest(`${domain}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, bodyStr);

      const data = gqlRes.json();
      const result = data?.data?.shopPolicyUpdate;
      const userErrors = result?.userErrors || [];

      if (userErrors.length > 0) {
        const msgs = userErrors.map(e => e.message).join(', ');
        console.error(`❌ Policy update errors:`, JSON.stringify(userErrors));

        // Shopify locks auto-managed policies — give the user instructions
        if (msgs.toLowerCase().includes('automatic management')) {
          const policyName = policyType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return res.json({
            success: true,
            manual: true,
            message: `Your "${policyName}" is auto-managed by Shopify. To update it: Go to Shopify Admin → Settings → Policies → turn off "Automatically generated" for this policy, then try again.`,
          });
        }
        return res.status(400).json({ error: msgs });
      }

      console.log(`✅ Policy "${shopifyPolicyType}" updated successfully`);
      return res.json({ success: true, result: result?.shopPolicy });
    } catch (err) {
      console.error(`❌ Policy fix error:`, err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  let mutationDef = MUTATIONS[type];
  if (!mutationDef) {
    return res.status(400).json({ error: `Unknown fix type: ${type}` });
  }

  try {
    const endpoint = `${normalizeDomain(shop)}/admin/api/2024-10/graphql.json`;

    // Resolve handle → GID if the AI didn't provide a proper GID
    console.log(`🔧 Fix request: type=${type}, resourceId="${resourceId}", title="${resourceTitle}", isGID=${resourceId?.startsWith('gid://')}`);
    const resolvedId = await resolveResourceId(resourceId, type, endpoint, token, resourceTitle);
    console.log(`🔧 Resolved ID: "${resolvedId}"`);

    let result = await executeMutation(mutationDef, resolvedId, newValue, extra, endpoint, token);

    // If failed and has a fallback (e.g., page_content → page_create), try the fallback
    if (result.userErrors.length > 0 && mutationDef.fallbackType) {
      const fallbackDef = MUTATIONS[mutationDef.fallbackType];
      if (fallbackDef) {
        console.log(`⤵️ Falling back from ${type} to ${mutationDef.fallbackType}`);
        // Pass the label as the page title via extra
        const fallbackExtra = { ...extra, title: extra?.title || resourceId?.replace(/gid:\/\/shopify\/\w+\//, '') || 'New Page' };
        // Try to extract a better title from the fix label
        if (req.body.label) {
          const titleMatch = req.body.label.match(/(?:Create|Add|Update)\s+(.+?)(?:\s+page)?$/i);
          if (titleMatch) fallbackExtra.title = titleMatch[1];
        }
        result = await executeMutation(fallbackDef, resourceId, newValue, fallbackExtra, endpoint, token);
      }
    }

    if (!result.ok) {
      console.error(`Fix API error (${result.status}):`, JSON.stringify(result.data, null, 2));
      return res.status(result.status).json({ error: 'Shopify API error', detail: result.data });
    }

    if (result.userErrors.length > 0) {
      console.error('Fix validation errors:', result.userErrors);
      return res.status(422).json({ error: 'Validation failed', userErrors: result.userErrors });
    }

    console.log(`✅ Fix applied: ${type} on ${resourceId || '(new)'}`);
    return res.json({ success: true, result: result.data?.data?.[result.mutationKey] });
  } catch (err) {
    console.error('Fix apply error:', err.message);
    return res.status(500).json({ error: 'Fix failed: ' + err.message });
  }
});

export default router;
