export async function fetchStoreAudit(shop: string, token: string) {
  const response = await fetch('/api/audit/store', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({ shop }), // Body mainly just to not be empty
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Audit failed');
  }
  return response.json();
}

export async function fetchProductAnalysis(shop: string, product: any, token: string) {
  const response = await fetch('/api/audit/product', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({ shop, product }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  return response.json();
}
