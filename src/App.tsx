import { useState, useEffect, useRef } from 'react';
import { LoginView } from './features/auth/LoginView';
import { ExtractingView } from './features/extraction/ExtractingView';
import { DashboardView } from './features/dashboard/DashboardView';
import { fetchShopifyData } from './lib/shopify';
import { transformShopifyData } from './lib/transformers';

type ViewState = 'login' | 'extracting' | 'dashboard' | 'error';

const CACHE_KEY = 'axiom_store_data';

// Detect if we're inside Shopify's embedded iframe
const isEmbedded = window.self !== window.top;

function App() {
  const [view, setView] = useState<ViewState>(isEmbedded ? 'extracting' : 'login');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [masterJson, setMasterJson] = useState<any>(null);
  const autoStarted = useRef(false);

  const handleExtract = async (domain: string, token: string) => {
    setView('extracting');
    setErrorMessage('');
    try {
      // Persist in sessionStorage so we survive re-renders
      sessionStorage.setItem('shopify_shop', domain);
      sessionStorage.setItem('shopify_token', token);

      const rawData = await fetchShopifyData(domain, token);
      const transformedData = transformShopifyData(rawData);

      // Cache the extracted data
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(transformedData)); } catch {}

      setMasterJson(transformedData);
      setView('dashboard');
    } catch (error: any) {
      console.error("Extraction failed:", error);
      setErrorMessage(error.message || 'An unknown error occurred during extraction.');
      // If embedded, show dashboard with empty data instead of login page
      if (isEmbedded) {
        setMasterJson(transformShopifyData({}));
        setView('dashboard');
      } else {
        setView('error');
      }
    }
  };

  // Called from DashboardView when user clicks "Re-extract & Analyze"
  const handleReExtract = () => {
    // Clear all cached data
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem('axiom_audit');

    const shop = sessionStorage.getItem('shopify_shop');
    const token = sessionStorage.getItem('shopify_token');
    if (shop && token) {
      handleExtract(shop, token);
    }
  };

  // Silent background re-extraction (no loading screen, no audit clear)
  const refreshData = async () => {
    const shop = sessionStorage.getItem('shopify_shop');
    const token = sessionStorage.getItem('shopify_token');
    if (!shop || !token) return;
    try {
      console.log('🔄 Silent re-extraction after fix...');
      const rawData = await fetchShopifyData(shop, token);
      const transformedData = transformShopifyData(rawData);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(transformedData)); } catch {}
      setMasterJson(transformedData);
      console.log('✅ Store data refreshed');
    } catch (err: any) {
      console.warn('⚠️ Silent re-extraction failed:', err.message);
    }
  };

  // Auto-extract if shop & token are available
  useEffect(() => {
    if (autoStarted.current) return;

    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop') || sessionStorage.getItem('shopify_shop');
    const token = params.get('token') || sessionStorage.getItem('shopify_token');

    if (shop && token) {
      autoStarted.current = true;
      // Clean the URL so tokens aren't visible
      window.history.replaceState({}, '', window.location.pathname);

      // Check for cached data first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsedData = JSON.parse(cached);
          console.log('📦 Using cached store data');
          sessionStorage.setItem('shopify_shop', shop);
          sessionStorage.setItem('shopify_token', token);
          setMasterJson(parsedData);
          setView('dashboard');
          return;
        }
      } catch {}

      // No cache — do fresh extraction
      handleExtract(shop, token);
    } else if (isEmbedded) {
      // We're inside Shopify admin iframe but have no token
      // Try multiple sources for the shop domain
      let embeddedShop = params.get('shop');

      // Fallback: extract shop from Shopify admin URL (referrer or ancestor origin)
      if (!embeddedShop) {
        try {
          const ref = document.referrer || '';
          // Shopify admin URLs: admin.shopify.com/store/{handle} or {shop}.myshopify.com/admin
          const myshopMatch = ref.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
          if (myshopMatch) embeddedShop = myshopMatch[1];

          if (!embeddedShop) {
            // Try extracting from admin.shopify.com/store/{handle}/apps/...
            const storeMatch = ref.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9-]+)/);
            if (storeMatch) embeddedShop = `${storeMatch[1]}.myshopify.com`;
          }
        } catch {}
      }

      if (embeddedShop) {
        autoStarted.current = true;
        console.log(`🔄 Embedded mode — fetching session for ${embeddedShop}...`);
        fetch(`/api/auth/session?shop=${encodeURIComponent(embeddedShop)}`)
          .then(r => r.json())
          .then(data => {
            if (data.token) {
              console.log('✅ Got session token from backend');
              sessionStorage.setItem('shopify_shop', embeddedShop!);
              sessionStorage.setItem('shopify_token', data.token);
              handleExtract(embeddedShop!, data.token);
            } else {
              // No session — redirect to OAuth
              console.log('❌ No session — redirecting to OAuth...');
              window.top?.location.assign(`/api/auth?shop=${encodeURIComponent(embeddedShop!)}`);
            }
          })
          .catch(() => {
            window.top?.location.assign(`/api/auth?shop=${encodeURIComponent(embeddedShop!)}`);
          });
      } else {
        console.warn('⚠️ Embedded but cannot detect shop domain');
        setView('extracting');
      }
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--p-font-family-sans)' }}>
      {(view === 'login' || view === 'error') && !isEmbedded && (
        <LoginView onExtract={handleExtract} error={errorMessage} />
      )}
      {view === 'extracting' && <ExtractingView />}
      {view === 'dashboard' && masterJson && (
        <DashboardView data={masterJson} onReExtract={handleReExtract} refreshData={refreshData} />
      )}
    </div>
  );
}

export default App;
