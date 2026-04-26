// In-memory token store: shop domain -> access_token (use a DB in production)
export const tokenStore = new Map();

// shop -> { policy: string, generatedAt: number }
export const policyStore = new Map();
