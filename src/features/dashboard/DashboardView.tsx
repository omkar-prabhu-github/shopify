import React, { useState } from 'react';
import {
  Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, InlineGrid, Banner, Spinner, TextField,
} from '@shopify/polaris';

import { useStoreAudit } from './hooks/useStoreAudit';
import { HealthGauge } from './components/HealthGauge';
import { ActionItemCard } from './components/ActionItemCard';
import { ProductRow } from './components/ProductRow';

interface DashboardViewProps { data: any; onReExtract?: () => void; }

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onReExtract }) => {
  const ctx = data?.store_context || {};
  const catalog = data?.catalog || [];
  const collections = data?.collections || [];
  const discounts = data?.discounts || [];
  const activeProducts = catalog.filter((p: any) => p.status === 'ACTIVE').length;
  const totalInv = catalog.reduce((s: number, p: any) => s + (p.total_inventory || 0), 0);
  const shop = sessionStorage.getItem('shopify_shop') || ctx?.domain || '';

  const {
    audit, loading: auditLoading, error: auditError, policyReady, cachedAudit,
    runFullAudit, clearAudit, clearError
  } = useStoreAudit(shop);

  const [searchQuery, setSearchQuery] = useState('');

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
          {cachedAudit && !auditLoading && (
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
                      clearAudit();
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
          {auditLoading && (
            <Card>
              <BlockStack gap="400" align="center" inlineAlign="center">
                <Box padding="400">
                  <BlockStack gap="300" align="center" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p" variant="headingSm">🔍 Running Deep Store Audit…</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Scanning all products for issues, risks, and improvements</Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          )}

          {auditError && (
            <Banner tone="critical" onDismiss={clearError}>
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
                      const ls = audit.layerScores[layer.key] as any;
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
                      {(audit.productAnalysis?.topPerformers || []).map((p: any, i: number) => (
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
                      {(audit.productAnalysis?.bottomPerformers || []).map((p: any, i: number) => (
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
                        {section.items.map((item: any, ii: number) => (
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
