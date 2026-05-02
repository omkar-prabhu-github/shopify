/**
 * Handles 401 responses by clearing stale session data and redirecting to OAuth.
 * Call this when any API returns 401 to trigger re-authentication.
 */
export function handleAuthExpiry(): never {
  const shop = sessionStorage.getItem('shopify_shop') || '';
  // Clear stale tokens
  sessionStorage.removeItem('shopify_token');
  sessionStorage.removeItem('axiom_store_data');
  sessionStorage.removeItem('axiom_audit');

  // Redirect to OAuth (using _top allows App Bridge to intercept and redirect the admin safely)
  if (shop) {
    const url = `/api/auth?shop=${encodeURIComponent(shop)}`;
    window.open(url, '_top');
  } else {
    window.location.reload();
  }
  throw new Error('Session expired — reconnecting...');
}

/**
 * Checks a fetch response for 401 and auto-handles it.
 * Returns the response if auth is OK.
 */
export function checkAuth(response: Response): Response {
  if (response.status === 401) {
    handleAuthExpiry();
  }
  return response;
}
