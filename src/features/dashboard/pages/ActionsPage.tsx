import React, { useState } from 'react';
import {
  Page, Card, Text, BlockStack, Box, Banner, Divider,
  InlineStack, Badge, Collapsible, EmptyState, Button,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { FixPreviewModal } from '../components/FixPreviewModal';
import type { FixPayload } from '../../../api/fixClient';

interface ActionItem {
  severity: string;
  principle: string;
  title: string;
  description: string;
  impact: string;
  fixes?: FixPayload[];
  // Legacy fields (backward compat)
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

function ActionCard({ item, onFixClick, appliedFixes, showFixes = true }: {
  item: ActionItem;
  onFixClick: (fix: FixPayload) => void;
  appliedFixes: Set<string>;
  showFixes?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const remainingFixes = showFixes ? (item.fixes || []).filter(f => !appliedFixes.has(fixKey(f))) : [];
  const allFixed = showFixes && (item.fixes?.length || 0) > 0 && remainingFixes.length === 0;
  const tone = severityTone(item.severity);

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center" wrap>
          <Text as="span" variant="bodyMd" fontWeight="semibold">{item.title}</Text>
          <Badge tone={tone}>{item.severity || item.impact || 'INFO'}</Badge>
          {item.principle && <Badge>Principle {item.principle}</Badge>}
          {!showFixes && <Badge tone="info">Suggestion</Badge>}
          {showFixes && allFixed && <Badge tone="success">✓ Fixed</Badge>}
          {showFixes && !allFixed && remainingFixes.length > 0 && (
            <Badge tone="info">{remainingFixes.length} fix{remainingFixes.length > 1 ? 'es' : ''}</Badge>
          )}
        </InlineStack>
        <Text as="p" variant="bodySm">{item.description || item.what || ''}</Text>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 12, fontWeight: 600, color: 'var(--p-color-text-emphasis)',
          }}
        >
          {open ? '▲ Hide details' : '▼ View details'}
        </button>
        <Collapsible open={open} id={`action-${item.title}`}>
          <BlockStack gap="300">
            <Box background="bg-surface-secondary" padding="300" borderRadius="200">
              <BlockStack gap="200">
                {(item.impact || item.why) && (
                  <Text as="p" variant="bodySm"><strong>Impact:</strong> {item.impact || item.why}</Text>
                )}
                {item.how && (
                  <Text as="p" variant="bodySm"><strong>How:</strong> {item.how}</Text>
                )}
              </BlockStack>
            </Box>
            {remainingFixes.length > 0 && (
              <BlockStack gap="200">
                <Text as="span" variant="headingSm">Available Fixes</Text>
                {remainingFixes.map((fix, i) => (
                  <Box key={i} background="bg-surface-info" padding="200" borderRadius="200">
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
                  </Box>
                ))}
              </BlockStack>
            )}
            {allFixed && (
              <Banner tone="success">
                <p>All fixes for this action have been applied.</p>
              </Banner>
            )}
          </BlockStack>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}

function fixKey(fix: FixPayload): string {
  return `${fix.type}::${fix.resourceId}::${fix.field}::${fix.label}`;
}

const CATEGORIES = [
  { key: 'storeInfrastructure', label: 'Store Infrastructure', icon: '🏗️', description: 'Pages, policies, and navigation issues' },
  { key: 'informationMismatch', label: 'Information Mismatch', icon: '⚠️', description: 'Contradictions and inconsistencies' },
  { key: 'productOptimization', label: 'Product Optimization', icon: '📦', description: 'Metadata, specs, and GEO readiness' },
  { key: 'strategicGrowth', label: 'Strategic Growth', icon: '🚀', description: 'Suggestions only — reviews, schema, domain, and long-term improvements' },
];

// Legacy tiers for backward compat with old audit data
const LEGACY_TIERS = [
  { key: 'critical', label: 'Critical — This Week', tone: 'critical' as const },
  { key: 'highPriority', label: 'High Priority — This Month', tone: 'warning' as const },
  { key: 'strategic', label: 'Strategic — This Quarter', tone: 'success' as const },
];

export const ActionsPage: React.FC = () => {
  const { audit, auditLoading, runFullAudit, shop, refreshData } = useDashboard();
  const [selectedFix, setSelectedFix] = useState<FixPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const handleFixClick = (fix: FixPayload) => {
    setSelectedFix(fix);
    setModalOpen(true);
  };

  const handleFixApplied = (fix: FixPayload) => {
    setAppliedFixes(prev => new Set([...prev, fixKey(fix)]));
  };

  if (!audit && !auditLoading) {
    return (
      <Page title="Diagnostics & Action Plan">
        <Card>
          <EmptyState
            heading="No action plan available"
            image=""
            action={{ content: 'Run GEO Audit', onAction: runFullAudit }}
          >
            <p>Run a full GEO audit to generate a prioritized action plan for your store.</p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  // Support new (diagnosticsAndActionPlan) and old (actionPlan) formats
  const diagPlan = audit?.diagnosticsAndActionPlan;
  const legacyPlan = audit?.actionPlan;
  const isNewFormat = !!diagPlan;

  const getAllItems = (): ActionItem[] => {
    if (isNewFormat) {
      return CATEGORIES.flatMap(cat => (diagPlan?.[cat.key] || []) as ActionItem[]);
    }
    return LEGACY_TIERS.flatMap(tier => (legacyPlan?.[tier.key] || []) as ActionItem[]);
  };

  const allItems = getAllItems();
  const totalFixes = allItems.reduce((s, item) => {
    const remaining = (item.fixes || []).filter(f => !appliedFixes.has(fixKey(f)));
    return s + remaining.length;
  }, 0);

  return (
    <Page
      title="Diagnostics & Action Plan"
      subtitle={`${allItems.length} actions · ${totalFixes} fix${totalFixes !== 1 ? 'es' : ''} remaining`}
    >
      <BlockStack gap="600">
        {appliedFixes.size > 0 && (
          <Banner tone="success">
            <p>{appliedFixes.size} fix{appliedFixes.size > 1 ? 'es' : ''} applied this session.</p>
          </Banner>
        )}

        {isNewFormat ? (
          // New format: 4 categories
          CATEGORIES.map((cat) => {
            const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            const items: ActionItem[] = (diagPlan?.[cat.key] || [])
              .slice()
              .sort((a: ActionItem, b: ActionItem) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
            const criticalCount = items.filter(i => i.severity === 'CRITICAL').length;
            const highCount = items.filter(i => i.severity === 'HIGH').length;
            return (
              <BlockStack key={cat.key} gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd">{cat.icon}</Text>
                  <Text as="h2" variant="headingMd">{cat.label}</Text>
                  <Badge>{items.length}</Badge>
                  {criticalCount > 0 && <Badge tone="critical">{criticalCount} critical</Badge>}
                  {highCount > 0 && <Badge tone="warning">{highCount} high</Badge>}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">{cat.description}</Text>
                {items.length > 0 ? (
                  items.map((item, i) => (
                    <ActionCard
                      key={i}
                      item={item}
                      onFixClick={handleFixClick}
                      appliedFixes={appliedFixes}
                      showFixes={cat.key !== 'strategicGrowth'}
                    />
                  ))
                ) : (
                  <Card>
                    <Text as="p" variant="bodySm" tone="subdued">No issues found in this category. ✓</Text>
                  </Card>
                )}
                <Divider />
              </BlockStack>
            );
          })
        ) : (
          // Legacy format: 3 tiers
          LEGACY_TIERS.map((tier) => {
            const items: ActionItem[] = legacyPlan?.[tier.key] || [];
            return (
              <BlockStack key={tier.key} gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">{tier.label}</Text>
                  <Badge tone={tier.tone}>{items.length}</Badge>
                </InlineStack>
                {items.length > 0 ? (
                  items.map((item, i) => (
                    <ActionCard
                      key={i}
                      item={item}
                      onFixClick={handleFixClick}
                      appliedFixes={appliedFixes}
                    />
                  ))
                ) : (
                  <Card>
                    <Text as="p" variant="bodySm" tone="subdued">No actions in this tier.</Text>
                  </Card>
                )}
              </BlockStack>
            );
          })
        )}
      </BlockStack>

      <FixPreviewModal
        open={modalOpen}
        fix={selectedFix}
        shop={shop}
        onClose={() => { setModalOpen(false); setSelectedFix(null); }}
        onFixed={handleFixApplied}
        refreshData={refreshData}
      />
    </Page>
  );
};
