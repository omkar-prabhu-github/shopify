import { checkAuth } from '../utils/authGuard';

export interface FixPayload {
  type: string;
  resourceId: string;
  resourceTitle?: string;
  field: string;
  oldValue: string;
  newValue: string;
  label: string;
  extra?: Record<string, string>;
}

export async function applyFix(shop: string, token: string, fix: FixPayload) {
  const response = await fetch('/api/fix/apply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({
      type: fix.type,
      resourceId: fix.resourceId,
      resourceTitle: fix.resourceTitle,
      field: fix.field,
      newValue: fix.newValue,
      extra: fix.extra,
      label: fix.label,
    }),
  });

  checkAuth(response);
  const data = await response.json();
  if (!response.ok) {
    const msg = data.userErrors?.map((e: any) => e.message).join(', ') || data.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
}
