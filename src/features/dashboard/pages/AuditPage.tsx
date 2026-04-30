import React from 'react';
import {
  Page, Card, Text, BlockStack, Box, Banner, Button,
  InlineStack, Layout, EmptyState, Divider, Badge,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';

const GEO_LAYERS = [
  { key: 'schema', label: 'Schema', max: 20 },
  { key: 'contentQuality', label: 'Content Quality', max: 20 },
  { key: 'trust', label: 'Trust Signals', max: 15 },
  { key: 'extractability', label: 'Extractability', max: 15 },
  { key: 'journeyPolicy', label: 'Journey & Policy', max: 20 },
  { key: 'crossEngine', label: 'Cross-Engine', max: 10 },
];

const CATEGORIES = [
  { key: 'storeInfrastructure', label: 'Store Infrastructure', icon: '🏗️' },
  { key: 'informationMismatch', label: 'Information Mismatch', icon: '⚠️' },
  { key: 'productOptimization', label: 'Product Optimization', icon: '📦' },
  { key: 'strategicGrowth', label: 'Strategic Growth', icon: '🚀' },
];

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const tone = pct >= 70 ? 'success' : pct >= 40 ? 'caution' : 'critical';
  const barColor = tone === 'success' ? 'var(--p-color-bg-fill-success)' :
                   tone === 'caution' ? 'var(--p-color-bg-fill-caution)' :
                   'var(--p-color-bg-fill-critical)';
  return (
    <Box paddingBlockEnd="300">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm" fontWeight="semibold">{label}</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold" tone={tone}>{score}/{max}</Text>
      </InlineStack>
      <div style={{ height: 8, background: 'var(--p-color-bg-fill-secondary)', borderRadius: 4, marginTop: 4 }}>
        <div style={{
          height: '100%', borderRadius: 4, background: barColor,
          width: `${pct}%`, transition: 'width 0.6s ease',
        }} />
      </div>
    </Box>
  );
}

function CategoryScoreCard({ label, icon, score }: { label: string; icon: string; score: number }) {
  const tone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'critical';
  const barColor = score >= 80 ? 'var(--p-color-bg-fill-success)' :
                   score >= 60 ? 'var(--p-color-bg-fill-caution)' :
                   'var(--p-color-bg-fill-critical)';
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Text as="span" variant="bodySm">{icon}</Text>
          <Text as="span" variant="bodySm" fontWeight="semibold">{label}</Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p" variant="headingLg" tone={tone}>{score}</Text>
          <Badge tone={tone}>/100</Badge>
        </InlineStack>
        <div style={{ height: 6, background: 'var(--p-color-bg-fill-secondary)', borderRadius: 3 }}>
          <div style={{
            height: '100%', borderRadius: 3, background: barColor,
            width: `${score}%`, transition: 'width 0.6s ease',
          }} />
        </div>
      </BlockStack>
    </Card>
  );
}

export const AuditPage: React.FC = () => {
  const { audit, auditLoading, auditError, runFullAudit, clearError } = useDashboard();

  if (!audit && !auditLoading) {
    return (
      <Page title="GEO Audit">
        <Card>
          <EmptyState
            heading="No audit data available"
            image=""
            action={{ content: 'Run GEO Audit', onAction: runFullAudit }}
          >
            <p>Run a full GEO audit to see detailed layer scores, category diagnostics, and optimization opportunities.</p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  // Support both old (layerScores) and new (geoLayerScores) field names
  const layerScores = audit?.geoLayerScores || audit?.layerScores;
  const categoryScores = audit?.categoryScores;

  return (
    <Page title="GEO Audit" subtitle="Detailed layer-by-layer analysis & category diagnostics">
      <BlockStack gap="500">

        {auditError && (
          <Banner tone="critical" onDismiss={clearError}><p>{auditError}</p></Banner>
        )}

        {/* ── Category Scores (Deductive) ── */}
        {categoryScores && (
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Audit Category Scores</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Deductive scoring — starts at 100, points deducted per issue found
            </Text>
            <Layout>
              {CATEGORIES.map(cat => (
                <Layout.Section key={cat.key} variant="oneQuarter">
                  <CategoryScoreCard
                    label={cat.label}
                    icon={cat.icon}
                    score={categoryScores[cat.key] || 0}
                  />
                </Layout.Section>
              ))}
            </Layout>
          </BlockStack>
        )}

        {/* ── GEO Layer Scores ── */}
        {layerScores && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">GEO Layer Scores</Text>
              <Divider />
              {GEO_LAYERS.map(layer => {
                const ls = layerScores[layer.key] as any;
                const score = ls?.score || 0;
                return (
                  <Box key={layer.key}>
                    <ScoreBar label={layer.label} score={score} max={layer.max} />
                    {ls?.details && (
                      <Box paddingBlockStart="100" paddingBlockEnd="200">
                        <Text as="p" variant="bodySm" tone="subdued">{ls.details}</Text>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </BlockStack>
          </Card>
        )}

        {/* ── Performers ── */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Top Performers</Text>
                <Divider />
                {(audit?.productAnalysis?.topPerformers || []).length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">No data available.</Text>
                ) : (
                  (audit.productAnalysis.topPerformers).map((p: any, i: number) => (
                    <Box key={i} background="bg-surface-success" padding="300" borderRadius="200">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="semibold">{p.title}</Text>
                        <Text as="span" variant="bodySm" fontWeight="bold" tone="success">{p.score}/100</Text>
                      </InlineStack>
                      <Box paddingBlockStart="100">
                        <Text as="p" variant="bodySm" tone="subdued">{p.reason}</Text>
                      </Box>
                    </Box>
                  ))
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Bottom Performers</Text>
                <Divider />
                {(audit?.productAnalysis?.bottomPerformers || []).length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">No data available.</Text>
                ) : (
                  (audit.productAnalysis.bottomPerformers).map((p: any, i: number) => (
                    <Box key={i} background="bg-surface-critical" padding="300" borderRadius="200">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="semibold">{p.title}</Text>
                        <Text as="span" variant="bodySm" fontWeight="bold" tone="critical">{p.score}/100</Text>
                      </InlineStack>
                      <Box paddingBlockStart="100">
                        <Text as="p" variant="bodySm" tone="subdued">{p.reason}</Text>
                      </Box>
                    </Box>
                  ))
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

      </BlockStack>
    </Page>
  );
};
