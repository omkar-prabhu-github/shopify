import React, { useState, useEffect, useRef } from 'react';
import {
  Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, InlineGrid, Banner, Spinner, TextField,
} from '@shopify/polaris';

interface DashboardViewProps { data: any; onReExtract?: () => void; }

/* ── Types ─────────────────────────────────────────────── */
interface LayerScore { score: number; details: string; }
interface ActionItem { title: string; principle: string; what: string; why: string; how: string; impact: string; }
interface PerfProduct { title: string; score: number; reason: string; }

interface GeoAudit {
  executiveSummary: { geoHealthScore: number; grade: string; topThreat: string; topOpportunity: string; };
  layerScores: { schema: LayerScore; contentQuality: LayerScore; trust: LayerScore; extractability: LayerScore; journeyPolicy: LayerScore; crossEngine: LayerScore; };
  productAnalysis: { topPerformers: PerfProduct[]; bottomPerformers: PerfProduct[]; };
  actionPlan: { critical: ActionItem[]; highPriority: ActionItem[]; strategic: ActionItem[]; };
  projectedImpact: { estimatedVisibilityIncrease: string; timeline: string; };
}

interface ProductAnalysis {
  riskLevel: string;
  overallScore: number;
  issues: string[];
  suggestions: string[];
  seoScore: number;
  complianceScore: number;
  contentScore: number;
}

/* ── Animated Health Gauge ─────────────────────────────── */
const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const [val, setVal] = useState(0);
  const radius = 52, circ = 2 * Math.PI * radius;

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min((now - start) / 1400, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = val >= 80 ? '#22c55e' : val >= 60 ? '#eab308' : '#ef4444';
  const offset = circ - (val / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', inset: 16, borderRadius: '50%', filter: 'blur(20px)', opacity: 0.4,
        background: color, transition: 'background 0.7s',
      }} />
      <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke 0.7s, stroke-dashoffset 0.05s' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 42, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5 }}>of 100</span>
      </div>
    </div>
  );
};

/* ── Action Item Card (for GEO Action Plan) ───────────── */
const ActionItemCard: React.FC<{ item: ActionItem; bg: string; border: string; accent: string }> = ({ item, bg, border, accent }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${border}`,
      borderLeft: `4px solid ${accent}`, overflow: 'hidden',
      animation: 'fadeSlideIn 0.4s both',
    }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{item.title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color: accent, textTransform: 'uppercase' as const }}>{item.impact}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#475569' }}>Principle {item.principle}</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>{item.what}</p>
            <button onClick={() => setOpen(!open)} style={{
              marginTop: 8, fontSize: 12, fontWeight: 600, color: '#2563eb',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
              {open ? '▲ Hide details' : '▼ View details'}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong>Why:</strong> {item.why}</div>
            <div><strong>How:</strong> {item.how}</div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Finding Card ──────────────────────────────────────── */

/* ── Product Row with HF Analysis ──────────────────────── */
const ProductRow: React.FC<{ product: any; shop: string; policyReady: boolean }> = ({ product, shop, policyReady }) => {
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
      const res = await fetch('http://localhost:3000/api/audit/product', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, product }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const r = await res.json();
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

/* ═══════════════════════════════════════════════════════════
   ██  MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════ */
export const DashboardView: React.FC<DashboardViewProps> = ({ data, onReExtract }) => {
  const ctx = data?.store_context || {};
  const catalog = data?.catalog || [];
  const collections = data?.collections || [];
  const discounts = data?.discounts || [];
  const activeProducts = catalog.filter((p: any) => p.status === 'ACTIVE').length;
  const totalInv = catalog.reduce((s: number, p: any) => s + (p.total_inventory || 0), 0);
  const shop = sessionStorage.getItem('shopify_shop') || ctx?.domain || '';

  const AUDIT_CACHE_KEY = 'agentlens_audit';

  // Try restoring cached audit on initial render
  const getCachedAudit = (): StoreAudit | null => {
    try {
      const raw = sessionStorage.getItem(AUDIT_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const cachedAudit = getCachedAudit();

  const [audit, setAudit] = useState<GeoAudit | null>(cachedAudit);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [policyReady, setPolicyReady] = useState(!!cachedAudit); // true if we have audit, unlocks deep scans
  const [policyLoading, setPolicyLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const didAutoRun = useRef(false);

  const runFullAudit = async () => {
    setAuditError('');
    setAuditLoading(true);
    setPolicyLoading(true); // Re-using this to show "Generating context..." if needed, or just remove it
    try {
      const aRes = await fetch('http://localhost:3000/api/audit/store', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, storeData: data }),
      });
      if (!aRes.ok) { const e = await aRes.json().catch(() => ({})); throw new Error(e.error || 'Audit failed'); }
      const result = await aRes.json();
      setAudit(result);
      setPolicyReady(true);
      // Cache the audit results
      try { sessionStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify(result)); } catch {}
    } catch (e: any) {
      setAuditError('Store audit failed: ' + e.message);
    }
    setAuditLoading(false);
    setPolicyLoading(false);
  };

  // Auto-run only if no cached audit
  useEffect(() => {
    if (didAutoRun.current || !shop || cachedAudit) return;
    didAutoRun.current = true;
    runFullAudit();
  }, [shop]);


  const filteredCatalog = catalog.filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q) || p.product_type?.toLowerCase().includes(q);
  });

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'store_data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-bar {
          height: 14px; border-radius: 7px; margin: 6px 0;
          background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      <Page
        title={ctx?.name || 'Store Dashboard'}
        subtitle={cachedAudit ? 'AI-Powered Store Health Audit · Using cached results' : 'AI-Powered Store Health Audit'}
        primaryAction={{ content: '📥 Export Data', onAction: handleDownload }}
      >
        <BlockStack gap="500">

          {/* ── Stat Cards ──────────────────────────────── */}
          <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="400">
            {[
              { label: 'Products', val: catalog.length, sub: `${activeProducts} active` },
              { label: 'Collections', val: collections.length, sub: '' },
              { label: 'Customers', val: ctx?.stats?.customers_count || 0, sub: '' },
              { label: 'Orders', val: ctx?.stats?.orders_count || 0, sub: '' },
              { label: 'Inventory', val: totalInv.toLocaleString(), sub: `${discounts.length} discounts` },
            ].map((s, i) => (
              <Card key={i}>
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm" tone="subdued">{s.label}</Text>
                  <Text as="p" variant="headingLg">{s.val}</Text>
                  {s.sub && <Text as="p" variant="bodySm" tone="subdued">{s.sub}</Text>}
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>

          {/* ── Re-extract Button ──────────────────────── */}
          {cachedAudit && !auditLoading && !policyLoading && (
            <Banner tone="info" onDismiss={undefined}>
              <InlineStack align="space-between" blockAlign="center" gap="400">
                <Text as="p" variant="bodyMd">
                  Showing cached results. Click to re-extract fresh data from your store and run a new AI analysis.
                </Text>
                <Button
                  onClick={() => {
                    if (onReExtract) {
                      onReExtract();
                    } else {
                      sessionStorage.removeItem(AUDIT_CACHE_KEY);
                      sessionStorage.removeItem('agentlens_store_data');
                      setAudit(null);
                      setPolicyReady(false);
                      didAutoRun.current = false;
                      runFullAudit();
                    }
                  }}
                  variant="primary"
                >
                  🔄 Re-extract &amp; Analyze
                </Button>
              </InlineStack>
            </Banner>
          )}

          {/* ── Audit Loading State ─────────────────────── */}
          {(policyLoading || auditLoading) && (
            <Card>
              <BlockStack gap="400" align="center" inlineAlign="center">
                <Box padding="400">
                  <BlockStack gap="300" align="center" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p" variant="headingSm">
                      {policyLoading ? '🧠 Generating Global Policy with Gemini…' : '🔍 Running Deep Store Audit…'}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {policyLoading ? 'Analyzing your store policies, terms, and settings' : 'Scanning all products for issues, risks, and improvements'}
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          )}

          {auditError && (
            <Banner tone="critical" onDismiss={() => setAuditError('')}>
              <p>{auditError}</p>
            </Banner>
          )}

          {/* ── GEO Audit Results ─────────────────────── */}
          {audit && (
            <>
              {/* Executive Summary */}
              <Layout>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="400" align="center" inlineAlign="center">
                      <Text as="h2" variant="headingMd">GEO Health Score</Text>
                      <HealthGauge score={audit.executiveSummary?.geoHealthScore || 0} />
                      <Badge tone={audit.executiveSummary?.geoHealthScore >= 80 ? 'success' : audit.executiveSummary?.geoHealthScore >= 60 ? 'warning' : 'critical'}>
                        Grade: {audit.executiveSummary?.grade || 'N/A'}
                      </Badge>
                    </BlockStack>
                  </Card>
                </Layout.Section>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Executive Summary</Text>
                      <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #dc2626' }}>
                        <Text as="p" variant="bodySm" tone="subdued">🚨 Top Threat</Text>
                        <Text as="p" variant="bodyMd">{audit.executiveSummary?.topThreat || 'N/A'}</Text>
                      </div>
                      <div style={{ background: '#ecfdf5', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #16a34a' }}>
                        <Text as="p" variant="bodySm" tone="subdued">🚀 Top Opportunity</Text>
                        <Text as="p" variant="bodyMd">{audit.executiveSummary?.topOpportunity || 'N/A'}</Text>
                      </div>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              {/* Layer Scores */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">GEO Layer Scores</Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {audit.layerScores && [
                      { key: 'schema', label: '📐 Schema', max: 20, color: '#3b82f6' },
                      { key: 'contentQuality', label: '📝 Content Quality', max: 20, color: '#8b5cf6' },
                      { key: 'trust', label: '🛡️ Trust Signals', max: 15, color: '#06b6d4' },
                      { key: 'extractability', label: '🔍 Extractability', max: 15, color: '#f59e0b' },
                      { key: 'journeyPolicy', label: '🛒 Journey & Policy', max: 20, color: '#10b981' },
                      { key: 'crossEngine', label: '⚙️ Cross-Engine', max: 10, color: '#ef4444' },
                    ].map(layer => {
                      const ls = (audit.layerScores as any)[layer.key] as LayerScore | undefined;
                      const score = ls?.score || 0;
                      const pct = (score / layer.max) * 100;
                      return (
                        <div key={layer.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            <span>{layer.label}</span>
                            <span style={{ color: pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626' }}>{score}/{layer.max}</span>
                          </div>
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                            <div style={{ height: '100%', borderRadius: 4, background: layer.color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                          </div>
                          {ls?.details && <Text as="p" variant="bodySm" tone="subdued">{ls.details}</Text>}
                        </div>
                      );
                    })}
                  </div>
                </BlockStack>
              </Card>

              {/* Product Analysis — Top & Bottom Performers */}
              <Layout>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">🏆 Top Performers</Text>
                      {(audit.productAnalysis?.topPerformers || []).map((p, i) => (
                        <div key={i} style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', borderLeft: '3px solid #16a34a' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                            <span>{p.title}</span>
                            <span style={{ color: '#16a34a' }}>{p.score}/100</span>
                          </div>
                          <Text as="p" variant="bodySm" tone="subdued">{p.reason}</Text>
                        </div>
                      ))}
                      {(!audit.productAnalysis?.topPerformers?.length) && <Text as="p" variant="bodySm" tone="subdued">No data available.</Text>}
                    </BlockStack>
                  </Card>
                </Layout.Section>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">⚠️ Bottom Performers</Text>
                      {(audit.productAnalysis?.bottomPerformers || []).map((p, i) => (
                        <div key={i} style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 14px', borderLeft: '3px solid #dc2626' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                            <span>{p.title}</span>
                            <span style={{ color: '#dc2626' }}>{p.score}/100</span>
                          </div>
                          <Text as="p" variant="bodySm" tone="subdued">{p.reason}</Text>
                        </div>
                      ))}
                      {(!audit.productAnalysis?.bottomPerformers?.length) && <Text as="p" variant="bodySm" tone="subdued">No data available.</Text>}
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              {/* Action Plan */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">🎯 Prioritized Action Plan</Text>
                  {[
                    { tier: '🔴 Critical — This Week', items: audit.actionPlan?.critical || [], bg: '#fef2f2', border: '#fecaca', accent: '#dc2626' },
                    { tier: '🟡 High Priority — This Month', items: audit.actionPlan?.highPriority || [], bg: '#fffbeb', border: '#fde68a', accent: '#d97706' },
                    { tier: '🟢 Strategic — This Quarter', items: audit.actionPlan?.strategic || [], bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a' },
                  ].map((section, si) => (
                    <div key={si}>
                      <Text as="h3" variant="headingSm">{section.tier}</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {section.items.map((item, ii) => (
                          <ActionItemCard key={ii} item={item} bg={section.bg} border={section.border} accent={section.accent} />
                        ))}
                        {section.items.length === 0 && <Text as="p" variant="bodySm" tone="subdued">No actions in this tier.</Text>}
                      </div>
                    </div>
                  ))}
                </BlockStack>
              </Card>

              {/* Projected Impact */}
              {audit.projectedImpact && (
                <Card>
                  <InlineStack gap="400" align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">📈 Projected Impact</Text>
                      <Text as="p" variant="bodyMd">Estimated visibility increase: <strong>{audit.projectedImpact.estimatedVisibilityIncrease}</strong></Text>
                      <Text as="p" variant="bodySm" tone="subdued">Timeline: {audit.projectedImpact.timeline}</Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
              )}

              {/* AI Architecture Info */}
              <Card>
                <InlineStack gap="400" align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">AI Models</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Hybrid architecture powering your audit</Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>⚡ Gemini 2.5 Flash · GEO Audit</div>
                    <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>🧬 Gemma 4 31B · Product Scan</div>
                  </InlineStack>
                </InlineStack>
              </Card>
            </>
          )}

          {/* ── Product Catalog with HF Deep Scan ──────── */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Product Catalog</Text>
                <Text as="span" variant="bodySm" tone="subdued">{filteredCatalog.length} product{filteredCatalog.length !== 1 ? 's' : ''} · Per-product scan via Gemma 4 31B</Text>
              </InlineStack>

              <TextField
                label="Search products"
                labelAccessibilityVisibility="hidden"
                placeholder="Search products…"
                value={searchQuery}
                onChange={setSearchQuery}
                autoComplete="off"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredCatalog.length > 0 ? (
                  filteredCatalog.map((p: any, i: number) => (
                    <ProductRow key={p.id || i} product={p} shop={shop} policyReady={policyReady} />
                  ))
                ) : (
                  <Box padding="600">
                    <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                      {searchQuery ? 'No products match your search.' : 'No products found.'}
                    </Text>
                  </Box>
                )}
              </div>
            </BlockStack>
          </Card>

        </BlockStack>
      </Page>
    </>
  );
};
