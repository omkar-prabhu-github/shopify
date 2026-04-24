import React, { useState } from 'react';
import {
  Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, InlineGrid, Spinner, Banner, Icon,
} from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

interface DashboardViewProps { data: any; }

interface ProductAnalysis {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  issues: string[];
  suggestions: string[];
}

const riskConfig: Record<string, { tone: 'critical' | 'warning' | 'info' | 'success'; label: string; color: string }> = {
  HIGH:   { tone: 'critical', label: 'High Risk',   color: '#d82c0d' },
  MEDIUM: { tone: 'warning',  label: 'Medium Risk', color: '#8a6116' },
  LOW:    { tone: 'info',     label: 'Low Risk',    color: '#004777' },
  SAFE:   { tone: 'success',  label: 'Safe',        color: '#008060' },
};

/* ── Product Card ─────────────────────────────────────── */
const ProductCard: React.FC<{
  product: any;
  shop: string;
  policyReady: boolean;
}> = ({ product, shop, policyReady }) => {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const priceRange = product.variants?.length > 0
    ? product.variants.map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p))
    : [];
  const minPrice = priceRange.length > 0 ? Math.min(...priceRange) : null;
  const maxPrice = priceRange.length > 0 ? Math.max(...priceRange) : null;
  const priceDisplay = minPrice !== null
    ? minPrice === maxPrice ? `$${minPrice}` : `$${minPrice} – $${maxPrice}`
    : 'No price';

  const firstImage = product.images?.[0]?.url || null;

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const res = await fetch('http://localhost:3000/api/audit/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, product }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setAnalysis(result);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const risk = analysis ? riskConfig[analysis.riskLevel] || riskConfig.MEDIUM : null;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="400" align="start" wrap={false}>
          {/* Product Image */}
          <div style={{
            width: 72, height: 72, borderRadius: 12, overflow: 'hidden',
            background: '#f1f2f4', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {firstImage ? (
              <img src={firstImage} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Text as="span" tone="subdued" variant="bodySm">No img</Text>
            )}
          </div>

          {/* Product Info */}
          <BlockStack gap="100" >
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingSm">{product.title}</Text>
              <Badge tone={product.status === 'ACTIVE' ? 'success' : 'new'}>
                {product.status || 'DRAFT'}
              </Badge>
              {analysis && risk && <Badge tone={risk.tone}>{risk.label}</Badge>}
            </InlineStack>
            <InlineStack gap="300">
              {product.vendor && <Text as="span" variant="bodySm" tone="subdued">{product.vendor}</Text>}
              {product.product_type && <Text as="span" variant="bodySm" tone="subdued">• {product.product_type}</Text>}
              <Text as="span" variant="bodySm" fontWeight="semibold">{priceDisplay}</Text>
              <Text as="span" variant="bodySm" tone="subdued">{product.total_inventory} in stock</Text>
            </InlineStack>
            {product.tags?.length > 0 && (
              <InlineStack gap="100">
                {product.tags.slice(0, 5).map((tag: string, i: number) => (
                  <Badge key={i} tone="info">{tag}</Badge>
                ))}
                {product.tags.length > 5 && <Text as="span" variant="bodySm" tone="subdued">+{product.tags.length - 5}</Text>}
              </InlineStack>
            )}
          </BlockStack>

          {/* Action Button */}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Button
              onClick={runAnalysis}
              loading={loading}
              disabled={!policyReady || loading}
              variant="primary"
              icon={SearchIcon}
            >
              {analysis ? 'Re-Analyze' : 'Run Deep Analysis'}
            </Button>
          </div>
        </InlineStack>

        {/* Error Banner */}
        {error && (
          <Banner tone="critical" onDismiss={() => setError('')}>
            <p>{error}</p>
          </Banner>
        )}

        {/* Analysis Results */}
        {analysis && risk && (
          <Box paddingBlockStart="200">
            <div
              onClick={() => setExpanded(!expanded)}
              style={{
                cursor: 'pointer', padding: '12px 16px', borderRadius: 12,
                background: `${risk.color}10`, border: `1px solid ${risk.color}30`,
                transition: 'all 0.2s ease',
              }}
            >
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: risk.color,
                  }} />
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {analysis.riskLevel} — {analysis.issues.length} issue{analysis.issues.length !== 1 ? 's' : ''} found
                  </Text>
                </InlineStack>
                <Text as="span" variant="bodySm" tone="subdued">
                  {expanded ? '▲ Collapse' : '▼ Expand'}
                </Text>
              </InlineStack>
            </div>

            {expanded && (
              <Box paddingBlockStart="300">
                <BlockStack gap="300">
                  {/* Issues */}
                  {analysis.issues.length > 0 && (
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">⚠️ Issues</Text>
                      {analysis.issues.map((issue, i) => (
                        <Box key={i} padding="300" background="bg-surface-critical" borderRadius="200">
                          <Text as="p" variant="bodyMd">{issue}</Text>
                        </Box>
                      ))}
                    </BlockStack>
                  )}

                  {/* Suggestions */}
                  {analysis.suggestions?.length > 0 && (
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">💡 Suggestions</Text>
                      {analysis.suggestions.map((sug, i) => (
                        <Box key={i} padding="300" background="bg-surface-success" borderRadius="200">
                          <Text as="p" variant="bodyMd">{sug}</Text>
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Box>
            )}
          </Box>
        )}
      </BlockStack>
    </Card>
  );
};

/* ── Main Dashboard ───────────────────────────────────── */
export const DashboardView: React.FC<DashboardViewProps> = ({ data }) => {
  const ctx = data?.store_context || {};
  const catalog = data?.catalog || [];
  const collections = data?.collections || [];
  const discounts = data?.discounts || [];
  const activeProducts = catalog.filter((p: any) => p.status === 'ACTIVE').length;
  const totalInv = catalog.reduce((s: number, p: any) => s + (p.total_inventory || 0), 0);

  const [policyReady, setPolicyReady] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const shop = sessionStorage.getItem('shopify_shop') || ctx?.domain || '';

  const generatePolicy = async () => {
    setPolicyLoading(true);
    setPolicyError('');
    try {
      const res = await fetch('http://localhost:3000/api/policy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, storeContext: ctx }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      setPolicyReady(true);
    } catch (err: any) {
      setPolicyError(err.message || 'Failed to generate policy');
    } finally {
      setPolicyLoading(false);
    }
  };

  const filteredCatalog = catalog.filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.vendor?.toLowerCase().includes(q) ||
      p.product_type?.toLowerCase().includes(q) ||
      p.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  });

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'store_data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      title={ctx?.name || 'Store Dashboard'}
      subtitle={`${catalog.length} products · ${collections.length} collections · ${discounts.length} discounts`}
      primaryAction={{ content: 'Export Data', onAction: handleDownload }}
    >
      <BlockStack gap="400">
        {/* Stats Row */}
        <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="400">
          <Card>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" tone="subdued">Products</Text>
              <Text as="p" variant="headingLg">{catalog.length}</Text>
              <Text as="p" variant="bodySm" tone="subdued">{activeProducts} active</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" tone="subdued">Collections</Text>
              <Text as="p" variant="headingLg">{collections.length}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" tone="subdued">Customers</Text>
              <Text as="p" variant="headingLg">{ctx?.stats?.customers_count || 0}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" tone="subdued">Orders</Text>
              <Text as="p" variant="headingLg">{ctx?.stats?.orders_count || 0}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" tone="subdued">Inventory</Text>
              <Text as="p" variant="headingLg">{totalInv.toLocaleString()}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Policy Generation Banner */}
        {!policyReady && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">🧠 AI Policy Engine</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Generate a hidden global policy using Gemini AI. This policy is used as context for per-product deep analysis and is never displayed.
              </Text>
              {policyError && (
                <Banner tone="critical" onDismiss={() => setPolicyError('')}>
                  <p>{policyError}</p>
                </Banner>
              )}
              <InlineStack>
                <Button onClick={generatePolicy} loading={policyLoading} variant="primary">
                  {policyLoading ? 'Generating Policy…' : 'Generate Global Policy'}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {policyReady && (
          <Banner tone="success">
            <p>✅ Global policy generated. You can now run deep analysis on any product below.</p>
          </Banner>
        )}

        {/* Products List */}
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Product Catalog</Text>
                <Text as="span" variant="bodySm" tone="subdued">{filteredCatalog.length} product{filteredCatalog.length !== 1 ? 's' : ''}</Text>
              </InlineStack>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search products by name, vendor, type, or tag…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 16px 10px 40px',
                    borderRadius: 10, border: '1px solid #c9cccf',
                    fontSize: 14, outline: 'none', background: '#fff',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
                  <Icon source={SearchIcon} />
                </div>
              </div>

              {/* Product Cards */}
              {filteredCatalog.length > 0 ? (
                filteredCatalog.map((product: any, i: number) => (
                  <ProductCard
                    key={product.id || i}
                    product={product}
                    shop={shop}
                    policyReady={policyReady}
                  />
                ))
              ) : (
                <Card>
                  <Box padding="800">
                    <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                      {searchQuery ? 'No products match your search.' : 'No products found in this store.'}
                    </Text>
                  </Box>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
};
