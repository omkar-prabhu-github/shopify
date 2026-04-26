import React, { useState } from 'react';
import { fetchProductAnalysis } from '../../../api/auditClient';

export interface ProductAnalysis {
  riskLevel: string;
  overallScore: number;
  issues: string[];
  suggestions: string[];
  seoScore: number;
  complianceScore: number;
  contentScore: number;
}

export const ProductRow: React.FC<{ product: any; shop: string; policyReady: boolean }> = ({ product, shop, policyReady }) => {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const prices = (product.variants || []).map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p));
  const priceStr = prices.length > 0
    ? (Math.min(...prices) === Math.max(...prices) ? `$${Math.min(...prices)}` : `$${Math.min(...prices)} – $${Math.max(...prices)}`)
    : '—';
  const img = product.images?.[0]?.url || null;

  const runAnalysis = async () => {
    setLoading(true); setError(''); setAnalysis(null);
    try {
      const token = sessionStorage.getItem('shopify_token') || '';
      const r = await fetchProductAnalysis(shop, product, token);
      setAnalysis(r); setExpanded(true);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const riskColor: Record<string, string> = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#2563eb', SAFE: '#16a34a' };

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: '#f1f5f9',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
            <span style={{ fontSize: 20 }}>📦</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{product.title}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: product.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
              color: product.status === 'ACTIVE' ? '#16a34a' : '#64748b',
            }}>{product.status || 'DRAFT'}</span>
            {analysis && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: `${riskColor[analysis.riskLevel] || '#64748b'}15`,
                color: riskColor[analysis.riskLevel] || '#64748b',
              }}>{analysis.riskLevel}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 8 }}>
            {product.vendor && <span>{product.vendor}</span>}
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{priceStr}</span>
            <span>{product.total_inventory} in stock</span>
          </div>
        </div>
        <button onClick={runAnalysis} disabled={!policyReady || loading} style={{
          padding: '8px 16px', borderRadius: 10, border: 'none', fontWeight: 600, fontSize: 12,
          background: policyReady ? '#4f46e5' : '#e2e8f0', color: policyReady ? '#fff' : '#94a3b8',
          cursor: policyReady ? 'pointer' : 'not-allowed', transition: 'all 0.2s', flexShrink: 0,
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '⏳ Analyzing…' : analysis ? '🔄 Re-analyze' : '🔬 Deep Scan'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0 18px 12px', }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>
            {error}
          </div>
        </div>
      )}

      {analysis && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <div onClick={() => setExpanded(!expanded)} style={{
            padding: '10px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', fontSize: 12, color: '#64748b',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: (analysis.overallScore || 50) >= 70 ? '#16a34a' : (analysis.overallScore || 50) >= 50 ? '#d97706' : '#dc2626' }}>
                {analysis.overallScore || 50}/100
              </span>
              <span><strong>{analysis.issues?.length || 0}</strong> issue{(analysis.issues?.length || 0) !== 1 ? 's' : ''} · <strong>{analysis.suggestions?.length || 0}</strong> suggestion{(analysis.suggestions?.length || 0) !== 1 ? 's' : ''}</span>
            </div>
            <span>{expanded ? '▲' : '▼'}</span>
          </div>
          {expanded && (
            <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Score Bars */}
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: '🔍 SEO', score: analysis.seoScore, color: '#3b82f6' },
                  { label: '⚖️ Compliance', score: analysis.complianceScore, color: '#8b5cf6' },
                  { label: '📝 Content', score: analysis.contentScore, color: '#06b6d4' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                      <span>{s.label}</span>
                      <span style={{ color: (s.score || 0) >= 70 ? '#16a34a' : (s.score || 0) >= 50 ? '#d97706' : '#dc2626' }}>{s.score || 0}</span>
                    </div>
                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2, background: s.color, width: `${s.score || 0}%`, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Issues */}
              {(analysis.issues || []).map((issue, i) => (
                <div key={`i-${i}`} style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                  ⚠️ {issue}
                </div>
              ))}
              {/* Suggestions */}
              {(analysis.suggestions || []).map((sug, i) => (
                <div key={`s-${i}`} style={{ background: '#ecfdf5', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#065f46', lineHeight: 1.5 }}>
                  💡 {sug}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
