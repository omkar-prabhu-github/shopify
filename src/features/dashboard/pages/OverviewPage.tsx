import React, { useState } from 'react';
import {
  Page, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, InlineGrid, Banner, Spinner, Divider, Collapsible,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { HealthGauge } from '../components/HealthGauge';

// ── Clickable Layer Score Row ──
function LayerRow({ layer, sc, pct, color, dotColor, idx, info, reasoning }: {
  layer: { key: string; label: string; max: number };
  sc: number; pct: number; color: string; dotColor: string; idx: number;
  info?: { desc: string; factors: string[] };
  reasoning: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
      background: idx % 2 === 0 ? 'transparent' : 'var(--p-color-bg-surface-secondary)',
      transition: 'background 0.15s',
    }}
      onClick={() => setExpanded(!expanded)}
    >
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="200" blockAlign="center">
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, flexShrink: 0,
          }} />
          <Text as="span" variant="bodySm">{layer.label}</Text>
          <span style={{ fontSize: 10, color: 'var(--p-color-text-secondary)', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </InlineStack>
        <Text as="span" variant="bodySm" fontWeight="semibold">{sc}/{layer.max}</Text>
      </InlineStack>
      <div style={{ marginLeft: 24, marginTop: 4 }}>
        <div className="axiom-score-track">
          <div className="axiom-score-fill" style={{ background: color, width: `${pct}%` }} />
        </div>
      </div>

      <Collapsible open={expanded} id={`layer-${layer.key}`}>
        <div style={{
          marginTop: 10, marginLeft: 24, padding: '12px 16px',
          background: 'var(--p-color-bg-surface)', borderRadius: 8,
          borderLeft: `3px solid ${dotColor}`,
        }}>
          {info && (
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">{info.desc}</Text>
              <Text as="p" variant="bodySm" fontWeight="semibold">What we check:</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {info.factors.map((f, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'var(--p-color-bg-surface-secondary)',
                    color: 'var(--p-color-text-secondary)',
                  }}>{f}</span>
                ))}
              </div>
              {reasoning && (
                <>
                  <Text as="p" variant="bodySm" fontWeight="semibold">AI Assessment:</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{reasoning}</Text>
                </>
              )}
            </BlockStack>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

export const OverviewPage: React.FC = () => {
  const {
    data, audit, auditLoading, auditError,
    runFullAudit, clearAudit, clearError, onReExtract,
  } = useDashboard();

  const ctx = data?.store_context || {};
  const catalog = data?.catalog || [];
  const collections = data?.collections || [];
  const blogContent = data?.blog_content || [];
  const activeProducts = catalog.filter((p: any) => p.status === 'ACTIVE').length;
  const totalInv = catalog.reduce((s: number, p: any) => s + (p.total_inventory || 0), 0);

  const exec = audit?.executiveSummary;
  const score = exec?.geoHealthScore || 0;

  const stats = [
    { label: 'Products', val: catalog.length },
    { label: 'Active', val: activeProducts },
    { label: 'Collections', val: collections.length },
    { label: 'Orders', val: ctx?.stats?.orders_count || 0 },
    { label: 'Inventory', val: totalInv.toLocaleString() },
    { label: 'Blogs', val: blogContent.length },
  ];

  return (
    <Page
      title={ctx?.name || 'Store Overview'}
      primaryAction={
        audit
          ? { content: 'Re-run Audit', onAction: () => { if (onReExtract) onReExtract(); else { clearAudit(); runFullAudit(); } } }
          : (!auditLoading ? { content: 'Run GEO Audit', onAction: runFullAudit } : undefined)
      }
    >
      <BlockStack gap="400">

        {/* ── Store Stats (single card, 6 columns) ── */}
        <Card>
          <div className="axiom-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0 }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center',
                padding: '12px 8px',
                borderRight: i < 5 ? '1px solid var(--p-color-border-secondary)' : 'none',
              }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--p-color-text-subdued)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--p-color-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {String(s.val)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Audit Loading ── */}
        {auditLoading && (
          <Card>
            <Box padding="800">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">Analyzing your store…</Text>
                <Text as="p" variant="bodySm" tone="subdued">This may take up to 30 seconds</Text>
              </BlockStack>
            </Box>
          </Card>
        )}

        {auditError && (
          <Banner tone="critical" onDismiss={clearError}><p>{auditError}</p></Banner>
        )}

        {/* ── Empty State ── */}
        {!audit && !auditLoading && (
          <Card>
            <Box padding="800">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'var(--p-color-bg-fill-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>📊</div>
                <Text as="p" variant="headingSm">Run your first GEO audit</Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Analyze your store's Generative Engine Optimization health,<br />
                  get a score, and receive actionable recommendations.
                </Text>
                <Box paddingBlockStart="200">
                  <Button variant="primary" size="large" onClick={runFullAudit}>Run GEO Audit</Button>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* ── Audit Results ── */}
        {audit && !auditLoading && (
          <>
            {/* GEO Health + Executive Summary — horizontal layout */}
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0 }}>
                {/* Gauge */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px 16px',
                  borderRight: '1px solid var(--p-color-border-secondary)',
                }}>
                  <HealthGauge score={score} />
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Badge tone={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'critical'}>
                      Grade: {exec?.grade || '—'}
                    </Badge>
                  </div>
                </div>

                {/* Executive Summary */}
                <div style={{ padding: '20px 24px' }}>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingSm">Executive Summary</Text>
                    <Divider />
                    <Box padding="300" background="bg-surface-critical" borderRadius="200">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold" tone="critical">Top Threat</Text>
                        <Text as="p" variant="bodySm">{exec?.topThreat || '—'}</Text>
                      </BlockStack>
                    </Box>
                    <Box padding="300" background="bg-surface-success" borderRadius="200">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold" tone="success">Top Opportunity</Text>
                        <Text as="p" variant="bodySm">{exec?.topOpportunity || '—'}</Text>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </div>
              </div>
            </Card>

            {/* ── GEO Layer Scores ── */}
            {(() => {
              const ls = audit?.geoLayerScores || audit?.layerScores;
              if (!ls) return null;

              const LAYER_INFO: Record<string, { desc: string; factors: string[] }> = {
                schema: {
                  desc: 'How well your store is set up so AI assistants like ChatGPT and Google AI can read and understand your products, prices, and brand info.',
                  factors: ['Product info is readable by AI', 'Your brand details are clear', 'Pages are well-organized', 'Products show up with images on social media', 'Common questions are easy to find'],
                },
                contentQuality: {
                  desc: 'How detailed and helpful your product descriptions and store pages are. Better content means AI is more likely to recommend your products.',
                  factors: ['Descriptions are detailed enough', 'Benefits are clearly explained', 'Real numbers & stats are included', 'Products target the right customers', 'Key specs are listed'],
                },
                trust: {
                  desc: 'How trustworthy your store looks to AI and customers. Stores with strong trust signals get recommended more often.',
                  factors: ['Customer reviews', 'Custom domain name', 'Professional store name', 'Contact page with real info', 'Clear return & shipping policies'],
                },
                extractability: {
                  desc: 'How easy it is for AI to pull useful quotes and facts from your store to use in its answers when customers ask about products like yours.',
                  factors: ['Clear, quotable product statements', '"Perfect for…" type phrases', 'Product comparisons', 'FAQ answers', 'Standalone facts AI can cite'],
                },
                journeyPolicy: {
                  desc: 'Whether your store has all the essential pages customers and AI expect — like About Us, shipping info, and return policies.',
                  factors: ['About Us page', 'Shipping policy', 'Privacy & terms pages', 'Contact information', 'Easy navigation between pages'],
                },
                crossEngine: {
                  desc: 'How likely your store is to appear across different AI platforms — not just Google, but also ChatGPT, Bing, Perplexity, and others.',
                  factors: ['Shows up on multiple AI platforms', 'Answers common shopping questions', 'Stands out from competitors', 'Content is up to date', 'Has social proof & reviews'],
                },
              };

              const layers = [
                { key: 'schema', label: 'Schema & Structured Data', max: 20 },
                { key: 'contentQuality', label: 'Content Quality', max: 20 },
                { key: 'trust', label: 'Trust Signals', max: 15 },
                { key: 'extractability', label: 'Extractability', max: 15 },
                { key: 'journeyPolicy', label: 'Journey & Policy', max: 20 },
                { key: 'crossEngine', label: 'Cross-Engine Visibility', max: 10 },
              ];

              return (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingSm">GEO Layer Scores</Text>
                    <Divider />
                    <div className="axiom-stagger">
                      {layers.map((layer, idx) => {
                        const entry = ls[layer.key] as any;
                        const sc = entry?.score ?? 0;
                        const pct = Math.round((sc / layer.max) * 100);
                        const color = pct >= 70 ? 'var(--p-color-bg-fill-success)' :
                                      pct >= 40 ? 'var(--p-color-bg-fill-caution)' :
                                      'var(--p-color-bg-fill-critical)';
                        const dotColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
                        const info = LAYER_INFO[layer.key];
                        const reasoning = entry?.reasoning || entry?.detail || entry?.notes || '';

                        return <LayerRow key={layer.key} layer={layer} sc={sc} pct={pct}
                          color={color} dotColor={dotColor} idx={idx}
                          info={info} reasoning={reasoning} />;
                      })}
                    </div>
                  </BlockStack>
                </Card>
              );
            })()}
          </>
        )}

        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
};
