import { useState, useEffect, useRef } from 'react';
import { fetchStoreAudit } from '../../../api/auditClient';

const AUDIT_CACHE_KEY = 'agentlens_audit';

export function useStoreAudit(shop: string) {
  const getCachedAudit = () => {
    try {
      const raw = sessionStorage.getItem(AUDIT_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const cachedAudit = getCachedAudit();
  const [audit, setAudit] = useState<any | null>(cachedAudit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [policyReady, setPolicyReady] = useState(!!cachedAudit);
  
  const didAutoRun = useRef(false);

  const runFullAudit = async () => {
    setError('');
    setLoading(true);
    try {
      const token = sessionStorage.getItem('shopify_token') || '';
      const result = await fetchStoreAudit(shop, token);
      setAudit(result);
      setPolicyReady(true);
      try { sessionStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify(result)); } catch {}
    } catch (e: any) {
      setError('Store audit failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didAutoRun.current || !shop || cachedAudit) return;
    didAutoRun.current = true;
    runFullAudit();
  }, [shop]);

  const clearAudit = () => {
    sessionStorage.removeItem(AUDIT_CACHE_KEY);
    setAudit(null);
    setPolicyReady(false);
    didAutoRun.current = false;
  };

  return {
    audit,
    loading,
    error,
    policyReady,
    cachedAudit,
    runFullAudit,
    clearAudit,
    clearError: () => setError('')
  };
}
