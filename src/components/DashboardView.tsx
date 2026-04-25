import React, { useState, useEffect, useRef } from 'react';
import {
  Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, InlineGrid, Banner, Spinner, ProgressBar, TextField,
} from '@shopify/polaris';

interface DashboardViewProps { data: any; }

/* ── Types ─────────────────────────────────────────────── */
interface Finding {
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  product: string;
  explanation: string;
  suggestion: string;
}

interface StoreAudit {
  healthScore: number;
  summary: string;
  findings: Finding[];
}

interface ProductAnalysis {
  riskLevel: string;
  issues: string[];
  suggestions: string[];
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

/* ── Severity Badge Colors ─────────────────────────────── */
const sevStyle: Record<string, { bg: string; fg: string; border: string }> = {
  HIGH:   { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  MEDIUM: { bg: '#fffbeb', fg: '#d97706', border: '#fde68a' },
  LOW:    { bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe' },
};
const catIcons: Record<string, string> = {
  Policy: '📜', SEO: '🔍', Inventory: '📦', Pricing: '💰', Compliance: '⚖️', Content: '📝',
};

/* ── Finding Card ──────────────────────────────────────── */
const FindingCard: React.FC<{ f: Finding; i: number }> = ({ f, i }) => {
  const [open, setOpen] = useState(false);
  const s = sevStyle[f.severity] || sevStyle.LOW;
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${s.border}`,
      borderLeft: `4px solid ${s.fg}`, overflow: 'hidden',
      animation: `fadeSlideIn 0.4s ${i * 60}ms both`,
    }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{catIcons[f.category] || '🔎'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{f.title}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: s.bg, color: s.fg, textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{f.severity}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: '#f1f5f9', color: '#475569',
              }}>{f.category}</span>
              {f.product !== 'Store-wide' && (
                <span style={{ fontSize: 10, color: '#94a3b8' }}>• {f.product}</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>{f.explanation}</p>
            {f.suggestion && (
              <button onClick={() => setOpen(!open)} style={{
                marginTop: 8, fontSize: 12, fontWeight: 600, color: '#2563eb',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                {open ? '▲ Hide fix' : '▼ View fix'}
              </button>
            )}
          </div>
        </div>
      </div>
      {open && f.suggestion && (
        <div style={{ padding: '0 18px 14px 46px' }}>
          <div style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, color: '#065f46', lineHeight: 1.5,
          }}>
            <strong>Fix:</strong> {f.suggestion}
          </div>
        </div>
      )}
    </div>
  );
};

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
            <span><strong>{analysis.issues?.length || 0}</strong> issue{(analysis.issues?.length || 0) !== 1 ? 's' : ''} · <strong>{analysis.suggestions?.length || 0}</strong> suggestion{(analysis.suggestions?.length || 0) !== 1 ? 's' : ''}</span>
            <span>{expanded ? '▲' : '▼'}</span>
          </div>
          {expanded && (
            <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(analysis.issues || []).map((issue, i) => (
                <div key={`i-${i}`} style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                  ⚠️ {issue}
                </div>
              ))}
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
export const DashboardView: React.FC<DashboardViewProps> = ({ data }) => {
  const ctx = data?.store_context || {};
  const catalog = data?.catalog || [];
  const collections = data?.collections || [];
  const discounts = data?.discounts || [];
  const activeProducts = catalog.filter((p: any) => p.status === 'ACTIVE').length;
  const totalInv = catalog.reduce((s: number, p: any) => s + (p.total_inventory || 0), 0);
  const shop = sessionStorage.getItem('shopify_shop') || ctx?.domain || '';

  const [audit, setAudit] = useState<StoreAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [policyReady, setPolicyReady] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const didAutoRun = useRef(false);

  // Auto-run: generate policy → run store audit on mount
  useEffect(() => {
    if (didAutoRun.current || !shop) return;
    didAutoRun.current = true;
    (async () => {
      // Step 1: Generate policy
      setPolicyLoading(true);
      try {
        const pRes = await fetch('http://localhost:3000/api/policy/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, storeContext: ctx }),
        });
        if (!pRes.ok) { const e = await pRes.json().catch(() => ({})); throw new Error(e.error || 'Policy failed'); }
        setPolicyReady(true);
      } catch (e: any) {
        setAuditError('Policy generation failed: ' + e.message);
        setPolicyLoading(false);
        return;
      }
      setPolicyLoading(false);

      // Step 2: Run store audit
      setAuditLoading(true);
      try {
        const aRes = await fetch('http://localhost:3000/api/audit/store', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, storeData: data }),
        });
        if (!aRes.ok) { const e = await aRes.json().catch(() => ({})); throw new Error(e.error || 'Audit failed'); }
        const result = await aRes.json();
        setAudit(result);
      } catch (e: any) {
        setAuditError('Store audit failed: ' + e.message);
      }
      setAuditLoading(false);
    })();
  }, [shop]);

  const findings = audit?.findings || [];
  const highC = findings.filter(f => f.severity === 'HIGH').length;
  const medC = findings.filter(f => f.severity === 'MEDIUM').length;
  const lowC = findings.filter(f => f.severity === 'LOW').length;

  const filteredFindings = severityFilter === 'ALL'
    ? findings : findings.filter(f => f.severity === severityFilter);

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
        subtitle="AI-Powered Store Health Audit"
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

          {/* ── Audit Results ───────────────────────────── */}
          {audit && (
            <>
              {/* Health Score + Summary Row */}
              <Layout>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="400" align="center" inlineAlign="center">
                      <Text as="h2" variant="headingMd">Store Health Score</Text>
                      <HealthGauge score={audit.healthScore} />
                      <Badge tone={audit.healthScore >= 80 ? 'success' : audit.healthScore >= 60 ? 'warning' : 'critical'}>
                        {audit.healthScore >= 80 ? 'Excellent' : audit.healthScore >= 60 ? 'Fair' : 'Needs Attention'}
                      </Badge>
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">{audit.summary}</Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Risk Breakdown</Text>
                      <BlockStack gap="300">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>High Severity</span>
                          <span style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{highC}</span>
                        </div>
                        <ProgressBar progress={findings.length > 0 ? (highC / findings.length) * 100 : 0} tone="critical" size="small" />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Medium Severity</span>
                          <span style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{medC}</span>
                        </div>
                        <ProgressBar progress={findings.length > 0 ? (medC / findings.length) * 100 : 0} tone="highlight" size="small" />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Low Severity</span>
                          <span style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{lowC}</span>
                        </div>
                        <ProgressBar progress={findings.length > 0 ? (lowC / findings.length) * 100 : 0} tone="info" size="small" />
                      </BlockStack>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              {/* Findings List */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Findings ({filteredFindings.length})
                    </Text>
                    <InlineStack gap="200">
                      {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
                        <button key={s} onClick={() => setSeverityFilter(s)} style={{
                          padding: '4px 12px', borderRadius: 20, border: '1px solid',
                          borderColor: severityFilter === s ? '#4f46e5' : '#e2e8f0',
                          background: severityFilter === s ? '#4f46e5' : '#fff',
                          color: severityFilter === s ? '#fff' : '#64748b',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                          {s === 'ALL' ? `All (${findings.length})` : `${s} (${findings.filter(f => f.severity === s).length})`}
                        </button>
                      ))}
                    </InlineStack>
                  </InlineStack>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredFindings.length > 0 ? (
                      filteredFindings.map((f, i) => <FindingCard key={i} f={f} i={i} />)
                    ) : (
                      <Box padding="600">
                        <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                          {findings.length === 0 ? '🛡️ No issues found — your store looks healthy!' : 'No findings match this filter.'}
                        </Text>
                      </Box>
                    )}
                  </div>
                </BlockStack>
              </Card>
            </>
          )}

          {/* ── Product Catalog with HF Deep Scan ──────── */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Product Catalog</Text>
                <Text as="span" variant="bodySm" tone="subdued">{filteredCatalog.length} product{filteredCatalog.length !== 1 ? 's' : ''} · Per-product scan via Gemma 2B</Text>
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
