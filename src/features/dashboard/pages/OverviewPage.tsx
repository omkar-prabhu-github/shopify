import React from 'react';
import {
  Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, InlineGrid, Banner, Spinner, Divider,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { HealthGauge } from '../components/HealthGauge';

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

        {/* ── Store Stats ── */}
        <InlineGrid columns={{ xs: 3, md: 6 }} gap="200">
          {[
            { label: 'Products', val: catalog.length },
            { label: 'Active', val: activeProducts },
            { label: 'Collections', val: collections.length },
            { label: 'Orders', val: ctx?.stats?.orders_count || 0 },
            { label: 'Inventory', val: totalInv.toLocaleString() },
            { label: 'Blogs', val: blogContent.length },
          ].map((s, i) => (
            <Card key={i} padding="300">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">{s.label}</Text>
                <Text as="p" variant="headingMd">{String(s.val)}</Text>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        {/* ── Audit Loading ── */}
        {auditLoading && (
          <Card>
            <Box padding="600">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">Analyzing your store…</Text>
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
            <Box padding="600">
              <BlockStack gap="200" align="center" inlineAlign="center">
                <Text as="p" variant="headingSm">No audit data yet</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Run a GEO audit to see your store health score and recommendations.
                </Text>
                <Box paddingBlockStart="200">
                  <Button variant="primary" onClick={runFullAudit}>Run GEO Audit</Button>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* ── Audit Results ── */}
        {audit && !auditLoading && (
          <>
          <Layout>
            {/* Left: Health Gauge */}
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="300" align="center" inlineAlign="center">
                  <Text as="h2" variant="headingSm">GEO Health</Text>
                  <HealthGauge score={score} />
                  <Badge tone={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'critical'}>
                    {exec?.grade || '—'}
                  </Badge>
                  {audit.projectedImpact && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {audit.projectedImpact.estimatedVisibilityIncrease} · {audit.projectedImpact.timeline}
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Right: Executive Summary */}
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">Executive Summary</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Box padding="300" background="bg-surface-critical" borderRadius="200">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold" tone="critical">Top Threat</Text>
                        <Text as="p" variant="bodyMd">{exec?.topThreat || '—'}</Text>
                      </BlockStack>
                    </Box>
                    <Box padding="300" background="bg-surface-success" borderRadius="200">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold" tone="success">Top Opportunity</Text>
                        <Text as="p" variant="bodyMd">{exec?.topOpportunity || '—'}</Text>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* ── GEO Layer Scores ── */}
          {(() => {
            const ls = audit?.geoLayerScores || audit?.layerScores;
            if (!ls) return null;
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
                  {layers.map(layer => {
                    const entry = ls[layer.key] as any;
                    const sc = entry?.score ?? 0;
                    const pct = Math.round((sc / layer.max) * 100);
                    const color = pct >= 70 ? 'var(--p-color-bg-fill-success)' :
                                  pct >= 40 ? 'var(--p-color-bg-fill-caution)' :
                                  'var(--p-color-bg-fill-critical)';
                    return (
                      <Box key={layer.key}>
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodySm">{layer.label}</Text>
                          <Text as="span" variant="bodySm" fontWeight="semibold">{sc}/{layer.max}</Text>
                        </InlineStack>
                        <div style={{ height: 6, background: 'var(--p-color-bg-fill-secondary)', borderRadius: 3, marginTop: 4 }}>
                          <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                        </div>
                      </Box>
                    );
                  })}
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
