export const shopifyQuery = `
query GetStoreData {
  shop {
    name
    primaryDomain {
      url
      host
    }
  }
  blogs(first: 20) {
    edges {
      node {
        title
        handle
        articles(first: 50) {
          edges {
            node {
              id
              title
              handle
              author
              tags
              publishedAt
              body
            }
          }
        }
      }
    }
  }
  pages(first: 20) {
    edges {
      node {
        title
        handle
        body
      }
    }
  }
  collections(first: 50) {
    edges {
      node {
        id
        title
        handle
        description
        image {
          url
          altText
        }
        productsCount {
          count
        }
      }
    }
  }
  products(first: 50) {
    edges {
      node {
        id
        title
        handle
        descriptionHtml
        productType
        vendor
        tags
        status
        totalInventory
        images(first: 5) {
          edges {
            node {
              url
              altText
            }
          }
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              compareAtPrice
              sku
              inventoryQuantity
              availableForSale
            }
          }
        }
        metafields(first: 10) {
          edges {
            node {
              key
              value
              namespace
            }
          }
        }
      }
    }
  }
}
`;

export async function fetchShopifyData(domain: string, token: string) {
  const PROXY           = '/api/shopify';
  const PROXY_SHOP      = '/api/shopify/shop';
  const PROXY_POLICIES  = '/api/shopify/policies';
  const PROXY_DISCOUNTS = '/api/shopify/discounts';
  const PROXY_CUSTOMERS = '/api/shopify/customers-count';
  const PROXY_ORDERS    = '/api/shopify/orders-count';
  const PROXY_REDIRECTS = '/api/shopify/redirects';

  const h = {
    'Content-Type': 'application/json',
    'X-Shopify-Domain': domain,
    'X-Shopify-Token': token,
  };

  // All fetches in parallel — only GraphQL is fatal
  const [gqlRes, shopRes, policiesRes, discountsRes, customersRes, ordersRes, redirectsRes] = await Promise.all([
    fetch(PROXY, { method: 'POST', headers: h, body: JSON.stringify({ query: shopifyQuery }) }),
    fetch(PROXY_SHOP,      { method: 'GET', headers: h }),
    fetch(PROXY_POLICIES,  { method: 'GET', headers: h }),
    fetch(PROXY_DISCOUNTS, { method: 'GET', headers: h }),
    fetch(PROXY_CUSTOMERS, { method: 'GET', headers: h }),
    fetch(PROXY_ORDERS,    { method: 'GET', headers: h }),
    fetch(PROXY_REDIRECTS, { method: 'GET', headers: h }),
  ]);

  // GraphQL — try to get data, but don't crash if 403 or partial errors
  let gqlData: any = {};
  if (gqlRes.ok) {
    const gqlJson = await gqlRes.json();
    if (gqlJson.errors && !gqlJson.data) {
      // Complete failure (all fields denied) — log but continue with empty data
      console.warn('GraphQL errors (no data):', gqlJson.errors.map((e: any) => e.message).join(', '));
    } else {
      // Partial success or full success — use whatever data we got
      if (gqlJson.errors) {
        console.warn('GraphQL partial errors:', gqlJson.errors.map((e: any) => e.message).join(', '));
      }
      gqlData = gqlJson.data || {};
    }
  } else if (gqlRes.status === 403) {
    console.warn('GraphQL 403 — token may lack required scopes or be expired');
  } else {
    let message = `HTTP ${gqlRes.status}`;
    try {
      const errBody = await gqlRes.json();
      if (errBody?.proxyError) message = errBody.proxyError;
    } catch {}
    if (gqlRes.status === 401) message = '401 Unauthorized: Invalid Admin API Token';
    throw new Error(message);
  }

  // Best-effort REST data
  const safe = async (res: Response) => {
    try { return res.ok ? await res.json() : {}; } catch { return {}; }
  };

  const [shopJ, polJ, discJ, custJ, ordJ, redJ] = await Promise.all([
    safe(shopRes), safe(policiesRes),
    safe(discountsRes), safe(customersRes), safe(ordersRes), safe(redirectsRes),
  ]);

  return {
    ...gqlData,
    shopDetails:    shopJ?.shop         || {},
    policies:       polJ?.policies      || [],
    discounts:      discJ?.discounts    || [],
    customersCount: custJ?.count        ?? 0,
    ordersCount:    ordJ?.count         ?? 0,
    redirects:      redJ?.redirects     || [],
  };
}
