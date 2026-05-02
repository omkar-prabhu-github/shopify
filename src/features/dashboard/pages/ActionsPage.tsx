import React, { useState } from 'react';
import {
  Page, Card, Text, BlockStack, Box, Banner, Divider, Badge,
  InlineStack, Button, Collapsible, EmptyState,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { FixPreviewModal } from '../components/FixPreviewModal';
import type { FixPayload } from '../../../api/fixClient';
import { filterAlreadyFixed } from '../../../utils/aiFixRegistry';

interface ActionItem {
  severity: string;
  principle: string;
  title: string;
  description: string;
  impact: string;
  fixes?: FixPayload[];
  what?: string;
  why?: string;
  how?: string;
}

function severityTone(severity: string): 'critical' | 'warning' | 'info' | 'success' {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    case 'LOW': return 'success';
    default: return 'info';
  }
}

function fixKey(fix: FixPayload): string {
  return `${fix.type}::${fix.resourceId}::${fix.field}::${fix.label}`;
}

// ── Action Card ──
function ActionCard({ item, onFixClick, appliedFixes, showFixes = true }: {
  item: ActionItem;
  onFixClick: (fix: FixPayload) => void;
  appliedFixes: Set<string>;
  showFixes?: boolean;
}) {
  const remainingFixes = showFixes
    ? filterAlreadyFixed((item.fixes || [])
        .filter(f => !appliedFixes.has(fixKey(f))))
    : [];
  const [open, setOpen] = React.useState(false);
  const allFixed = showFixes && (item.fixes?.length || 0) > 0 && remainingFixes.length === 0;

  return (
    <div className="axiom-issue-row" style={{
      padding: 14,
      background: item.severity === 'CRITICAL' ? 'var(--p-color-bg-surface-critical)' :
        item.severity === 'HIGH' ? 'var(--p-color-bg-surface-caution)' : 'var(--p-color-bg-surface-secondary)',
    }}>
      <BlockStack gap="200">
        <InlineStack gap="300" blockAlign="start" wrap={false}>
          <div style={{ flexShrink: 0 }}>
            <Badge tone={severityTone(item.severity)}>{item.severity || 'INFO'}</Badge>
          </div>
          <BlockStack gap="100" align="start">
            <Text as="span" variant="bodySm" fontWeight="semibold">{item.title}</Text>
            <Text as="span" variant="bodySm" tone="subdued">{item.description || item.what || ''}</Text>
          </BlockStack>
          {allFixed && (
            <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
              <Badge tone="success">Fixed</Badge>
            </div>
          )}
        </InlineStack>

        <button onClick={() => setOpen(!open)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 12, fontWeight: 500, color: 'var(--p-color-text-emphasis)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span> {open ? 'Hide details' : 'View details'}
        </button>

        <Collapsible open={open} id={`action-${item.title}`}>
          <BlockStack gap="300">
            {(item.impact || item.why) && (
              <Box background="bg-surface" padding="300" borderRadius="200">
                <Text as="p" variant="bodySm"><strong>Impact:</strong> {item.impact || item.why}</Text>
                {item.how && <Text as="p" variant="bodySm"><strong>How:</strong> {item.how}</Text>}
              </Box>
            )}
            {remainingFixes.length > 0 && (
              <BlockStack gap="200">
                <Text as="span" variant="headingSm">Available Fixes</Text>
                {remainingFixes.map((fix, i) => (
                  <div key={i} className="axiom-issue-row" style={{
                    padding: 10, background: 'var(--p-color-bg-surface)',
                  }}>
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="span" variant="bodySm" fontWeight="semibold">{fix.label}</Text>
                        {fix.resourceTitle && (
                          <Text as="span" variant="bodySm" tone="subdued">{fix.resourceTitle}</Text>
                        )}
                      </BlockStack>
                      <Button size="slim" variant="primary" onClick={() => onFixClick(fix)}>
                        Preview &amp; Fix
                      </Button>
                    </InlineStack>
                  </div>
                ))}
              </BlockStack>
            )}
            {allFixed && (
              <Banner tone="success"><p>All fixes for this action have been applied.</p></Banner>
            )}
          </BlockStack>
        </Collapsible>
      </BlockStack>
    </div>
  );
}

const CATEGORIES = [
  { key: 'storeInfrastructure', label: 'Store Infrastructure', description: 'Pages, policies, and navigation issues', accent: '#6366f1' },
  { key: 'informationMismatch', label: 'Information Mismatch', description: 'Contradictions and inconsistencies', accent: '#f59e0b' },
  { key: 'productOptimization', label: 'Product Optimization', description: 'Metadata, specs, and GEO readiness', accent: '#22c55e' },
];

const GROWTH_KEY = 'strategicGrowth';

export const ActionsPage: React.FC = () => {
  const { audit, auditLoading, runFullAudit, shop, refreshData } = useDashboard();
  const [selectedFix, setSelectedFix] = useState<FixPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const handleFixClick = (fix: FixPayload) => { setSelectedFix(fix); setModalOpen(true); };
  const handleFixApplied = (fix: FixPayload) => { setAppliedFixes(prev => new Set([...prev, fixKey(fix)])); };

  if (!audit && !auditLoading) {
    return (
      <Page title="Actions">
        <Card>
          <Box padding="800">
            <BlockStack gap="300" align="center" inlineAlign="center">
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'var(--p-color-bg-fill-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>⚡</div>
              <Text as="p" variant="headingSm">No action plan available</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Run a full GEO audit to generate a prioritized action plan.
              </Text>
              <Box paddingBlockStart="200">
                <Button variant="primary" size="large" onClick={runFullAudit}>Run GEO Audit</Button>
              </Box>
            </BlockStack>
          </Box>
        </Card>
      </Page>
    );
  }

  const diagPlan = audit?.diagnosticsAndActionPlan;
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const allFixableItems = CATEGORIES.flatMap(cat =>
    ((diagPlan?.[cat.key] || []) as ActionItem[])
  );
  const totalFixes = allFixableItems.reduce((s, item) => {
    const remaining = (item.fixes || []).filter(f => !appliedFixes.has(fixKey(f)));
    return s + remaining.length;
  }, 0);

  // Keywords that indicate a manual-only action (domain, store name, etc.)
  const MANUAL_KEYWORDS = /\b(domain|\.myshopify|store\s*name|custom\s*domain|brand\s*name|rename\s*store)\b/i;

  const isManualOnly = (item: ActionItem) => {
    const text = `${item.title} ${item.description} ${item.what || ''}`;
    // Check if ALL fixes are manual-only types (store_name / shop_name only)
    const hasOnlyManualFixes = (item.fixes || []).length > 0 &&
      (item.fixes || []).every(f => ['store_name', 'shop_name'].includes(f.type));
    return MANUAL_KEYWORDS.test(text) || hasOnlyManualFixes;
  };

  // Move manual-only items from fixable categories into suggestions
  const manualItems: ActionItem[] = CATEGORIES.flatMap(cat =>
    ((diagPlan?.[cat.key] || []) as ActionItem[]).filter(isManualOnly)
  );

  const growthItems: ActionItem[] = [
    ...manualItems,
    ...((diagPlan?.[GROWTH_KEY] || []) as ActionItem[]),
  ]
    .slice()
    .sort((a: ActionItem, b: ActionItem) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return (
    <Page title="Actions" subtitle={`${totalFixes} fix${totalFixes !== 1 ? 'es' : ''} remaining`}>
      <BlockStack gap="400">
        {appliedFixes.size > 0 && (
          <Banner tone="success">
            <p>{appliedFixes.size} fix{appliedFixes.size > 1 ? 'es' : ''} applied this session.</p>
          </Banner>
        )}

        {/* ── Fixable Categories ── */}
        {CATEGORIES.map((cat) => {
          const items: ActionItem[] = (diagPlan?.[cat.key] || [])
            .filter((item: ActionItem) => !isManualOnly(item))
            .slice()
            .sort((a: ActionItem, b: ActionItem) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

          return (
            <Card key={cat.key}>
              <div style={{ borderLeft: `3px solid ${cat.accent}`, paddingLeft: 16, marginLeft: -16 }}>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">{cat.label}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{cat.description}</Text>
                  <Divider />
                  {items.length > 0 ? (
                    items.map((item, i) => (
                      <ActionCard key={i} item={item} onFixClick={handleFixClick} appliedFixes={appliedFixes} showFixes />
                    ))
                  ) : (
                    <Box padding="200">
                      <Text as="p" variant="bodySm" tone="subdued">No issues found ✓</Text>
                    </Box>
                  )}
                </BlockStack>
              </div>
            </Card>
          );
        })}

        {/* ── Strategic Growth (suggestions — visually distinct) ── */}
        <div style={{
          border: '1px dashed var(--p-color-border)',
          borderRadius: 12,
          background: 'var(--p-color-bg-surface-secondary)',
          padding: 20,
        }}>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingSm">Strategic Growth</Text>
              <Badge tone="info">Suggestions</Badge>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Long-term improvements — reviews, schema, domain, and growth opportunities. These cannot be auto-fixed.
            </Text>
            <Divider />
            {growthItems.length > 0 ? (
              growthItems.map((item, i) => (
                <div key={i} className="axiom-issue-row" style={{
                  padding: 14, background: 'var(--p-color-bg-surface)',
                }}>
                  <InlineStack gap="300" blockAlign="start" wrap={false}>
                    <div style={{ flexShrink: 0 }}>
                      <Badge tone={severityTone(item.severity)}>{item.severity || 'INFO'}</Badge>
                    </div>
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" fontWeight="semibold">{item.title}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">{item.description || item.what || ''}</Text>
                      {(item.impact || item.why) && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          <em>Impact: {item.impact || item.why}</em>
                        </Text>
                      )}
                    </BlockStack>
                  </InlineStack>
                </div>
              ))
            ) : (
              <Box padding="200">
                <Text as="p" variant="bodySm" tone="subdued">No suggestions at this time ✓</Text>
              </Box>
            )}
          </BlockStack>
        </div>

        <Box paddingBlockEnd="800" />
      </BlockStack>

      <FixPreviewModal
        open={modalOpen} fix={selectedFix} shop={shop}
        onClose={() => { setModalOpen(false); setSelectedFix(null); }}
        onFixed={handleFixApplied} refreshData={refreshData}
      />
    </Page>
  );
};
