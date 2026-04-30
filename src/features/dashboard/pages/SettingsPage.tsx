import React from 'react';
import {
  Page, Card, Text, BlockStack, Box, Button, InlineStack,
  Badge, Layout, Divider,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';

export const SettingsPage: React.FC = () => {
  const { data, shop, cachedAudit, clearAudit, runFullAudit, onReExtract } = useDashboard();
  const ctx = data?.store_context || {};

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'store_data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleReExtract = () => {
    if (onReExtract) {
      onReExtract();
    } else {
      clearAudit();
      runFullAudit();
    }
  };

  return (
    <Page title="Settings" subtitle="Store configuration and data management">
      <BlockStack gap="500">

        {/* ── Store Info ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Store Information</Text>
            <Divider />
            <Layout>
              <Layout.Section variant="oneHalf">
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Name:</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{ctx?.name || '—'}</Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Domain:</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{ctx?.domain || shop || '—'}</Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Currency:</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{ctx?.shop_info?.currency || '—'}</Text>
                  </InlineStack>
                </BlockStack>
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Location:</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {[ctx?.shop_info?.city, ctx?.shop_info?.country].filter(Boolean).join(', ') || '—'}
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Email:</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{ctx?.shop_info?.email || '—'}</Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">Plan:</Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{ctx?.shop_info?.plan || '—'}</Text>
                  </InlineStack>
                </BlockStack>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Card>

        {/* ── Data Management ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Data Management</Text>
            <Divider />
            <Text as="p" variant="bodySm" tone="subdued">
              Re-extract fresh data from your Shopify store and run a new AI analysis, or export the current data as JSON.
            </Text>
            <InlineStack gap="300">
              <Button onClick={handleReExtract} variant="primary">Re-extract &amp; Analyze</Button>
              <Button onClick={handleDownload}>Export JSON</Button>
              {cachedAudit && (
                <Button onClick={clearAudit} variant="plain" tone="critical">Clear cached audit</Button>
              )}
            </InlineStack>
          </BlockStack>
        </Card>

        {/* ── AI Configuration ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">AI Architecture</Text>
            <Divider />
            <Layout>
              <Layout.Section variant="oneHalf">
                <Box background="bg-surface-info" padding="400" borderRadius="200">
                  <BlockStack gap="200">
                    <Badge tone="info">Store-Level Audit</Badge>
                    <Text as="p" variant="headingSm">Gemini 2.5 Flash</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Performs comprehensive GEO health analysis across all 10 principles. Evaluates schema, content quality, trust signals, and competitive positioning.
                    </Text>
                  </BlockStack>
                </Box>
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                  <BlockStack gap="200">
                    <Badge>Product-Level Scan</Badge>
                    <Text as="p" variant="headingSm">Gemma 4 31B</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Deep scans individual products against store policy for compliance, SEO issues, and content quality. Runs on-demand per product.
                    </Text>
                  </BlockStack>
                </Box>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Card>

        {/* ── Cache Status ── */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Cache Status</Text>
            <Divider />
            <InlineStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">Store data:</Text>
              <Badge tone={data ? 'success' : undefined}>{data ? 'Loaded' : 'Empty'}</Badge>
            </InlineStack>
            <InlineStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">Audit results:</Text>
              <Badge tone={cachedAudit ? 'success' : undefined}>{cachedAudit ? 'Cached' : 'Not available'}</Badge>
            </InlineStack>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
};
