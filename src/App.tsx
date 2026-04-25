import { useState, useEffect, useRef } from 'react';
import { LoginView } from './components/LoginView';
import { ExtractingView } from './components/ExtractingView';
import { DashboardView } from './components/DashboardView';
import { fetchShopifyData } from './lib/shopify';
import { transformShopifyData } from './lib/transformers';

type ViewState = 'login' | 'extracting' | 'dashboard' | 'error';

const CACHE_KEY = 'agentlens_store_data';

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
    sessionStorage.removeItem('agentlens_audit');

    const shop = sessionStorage.getItem('shopify_shop');
    const token = sessionStorage.getItem('shopify_token');
    if (shop && token) {
      handleExtract(shop, token);
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
      // We're inside Shopify but have no credentials yet
      // Show a loading state — the backend root route should handle auth
      setView('extracting');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {(view === 'login' || view === 'error') && !isEmbedded && (
        <LoginView onExtract={handleExtract} error={errorMessage} />
      )}
      {view === 'extracting' && <ExtractingView />}
      {view === 'dashboard' && masterJson && (
        <DashboardView data={masterJson} onReExtract={handleReExtract} />
      )}
    </div>
  );
}

export default App;
