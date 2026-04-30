import React, { useState } from 'react';
import {
  Page, Card, Text, BlockStack, Box, TextField, Modal,
  InlineStack, Badge, Button, Banner, Divider, Spinner,
  InlineGrid, Layout,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { fetchProductAnalysis } from '../../../api/auditClient';
import { FixPreviewModal } from '../components/FixPreviewModal';
import type { FixPayload } from '../../../api/fixClient';

interface Issue {
  severity: string;
  category?: string;
  title: string;
  detail: string;
}

interface ProductAnalysis {
  overallScore: number;
  riskLevel: string;
  seoScore: number;
  geoScore: number;
  contentScore: number;
  imageScore: number;
  issues: Issue[];
  fixes?: FixPayload[];
}

function fixKey(fix: FixPayload): string {
  return `${fix.type}::${fix.resourceId}::${fix.field}::${fix.label}`;
}

// ── Score Card ──
function ScoreCard({ label, score, icon }: { label: string; score: number; icon: string }) {
  const tone = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'critical';
  const color = score >= 70 ? 'var(--p-color-bg-fill-success)' :
                score >= 40 ? 'var(--p-color-bg-fill-caution)' :
                'var(--p-color-bg-fill-critical)';
  return (
    <Card>
      <BlockStack gap="100" align="center" inlineAlign="center">
        <Text as="span" variant="bodySm">{icon}</Text>
        <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
        <Text as="span" variant="headingLg" fontWeight="bold" tone={tone}>{score}</Text>
        <div style={{ width: '100%', height: 4, background: 'var(--p-color-bg-fill-secondary)', borderRadius: 2 }}>
          <div style={{ height: '100%', borderRadius: 2, background: color, width: `${score}%`, transition: 'width 0.6s' }} />
        </div>
      </BlockStack>
    </Card>
  );
}

// ── Product Detail Modal ──
function ProductDetailModal({
  open, product, shop, policyReady, onClose, appliedFixes, onFixClick, onFixApplied,
}: {
  open: boolean;
  product: any;
  shop: string;
  policyReady: boolean;
  onClose: () => void;
  appliedFixes: Set<string>;
  onFixClick: (fix: FixPayload) => void;
  onFixApplied: (fix: FixPayload) => void;
}) {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!product) return null;

  const prices = (product.variants || []).map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p));
  const priceStr = prices.length > 0
    ? (Math.min(...prices) === Math.max(...prices) ? `$${Math.min(...prices)}` : `$${Math.min(...prices)} – $${Math.max(...prices)}`)
    : '—';
  const images = product.images || [];

  const runAnalysis = async () => {
    setLoading(true); setError(''); setAnalysis(null);
    try {
      const token = sessionStorage.getItem('shopify_token') || '';
      const r = await fetchProductAnalysis(shop, product, token);
      setAnalysis(r);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const enrichedFixes = (analysis?.fixes || []).map(f => ({
    ...f,
    resourceId: f.resourceId || product.id,
    resourceTitle: f.resourceTitle || product.title,
  })).filter(f => !appliedFixes.has(fixKey(f)));

  const handleClose = () => {
    setAnalysis(null);
    setError('');
    onClose();
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      default: return 'success';
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={product.title} large>
      <Modal.Section>
        <BlockStack gap="400">
          {/* ── Product Info ── */}
          <Layout>
            <Layout.Section variant="oneThird">
              <BlockStack gap="200">
                {images.length > 0 ? (
                  <div style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--p-color-bg-fill-secondary)' }}>
                    <img src={images[0].url} alt={images[0].altText || product.title} style={{ width: '100%', display: 'block' }} />
                  </div>
                ) : (
                  <Box padding="600" background="bg-surface-secondary" borderRadius="300">
                    <Text as="p" variant="headingLg" alignment="center">📦</Text>
                  </Box>
                )}
                {images.length > 1 && (
                  <InlineStack gap="200">
                    {images.slice(1, 5).map((img: any, i: number) => (
                      <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: 'var(--p-color-bg-fill-secondary)' }}>
                        <img src={img.url} alt={img.altText || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </InlineStack>
                )}
              </BlockStack>
            </Layout.Section>

            <Layout.Section>
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Badge tone={product.status === 'ACTIVE' ? 'success' : undefined}>{product.status || 'DRAFT'}</Badge>
                  {product.vendor && <Badge>{product.vendor}</Badge>}
                  {product.product_type && <Badge>{product.product_type}</Badge>}
                </InlineStack>

                <InlineStack gap="400">
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">Price</Text>
                    <Text as="span" variant="headingSm">{priceStr}</Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">Inventory</Text>
                    <Text as="span" variant="headingSm">{product.total_inventory ?? 0}</Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">Images</Text>
                    <Text as="span" variant="headingSm">{images.length}</Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">Variants</Text>
                    <Text as="span" variant="headingSm">{(product.variants || []).length}</Text>
                  </BlockStack>
                </InlineStack>

                {product.tags?.length > 0 && (
                  <InlineStack gap="100" wrap>
                    {product.tags.map((tag: string, i: number) => (
                      <Badge key={i} tone="info">{tag}</Badge>
                    ))}
                  </InlineStack>
                )}

                {product.description && (
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodySm">{product.description.slice(0, 300)}{product.description.length > 300 ? '…' : ''}</Text>
                  </Box>
                )}
              </BlockStack>
            </Layout.Section>
          </Layout>

          <Divider />

          {/* ── Analysis Section ── */}
          {!analysis && !loading && (
            <BlockStack gap="200" align="center" inlineAlign="center">
              <Button onClick={runAnalysis} disabled={!policyReady} variant="primary" size="large">
                🔬 Run Deep Analysis
              </Button>
              {!policyReady && (
                <Text as="p" variant="bodySm" tone="subdued">Run a GEO Audit first to enable product analysis</Text>
              )}
              <Text as="p" variant="bodySm" tone="subdued">
                Gemma 4 will analyze product data + images for SEO, GEO, content, and visual quality
              </Text>
            </BlockStack>
          )}

          {loading && (
            <BlockStack gap="200" align="center" inlineAlign="center">
              <Spinner size="large" />
              <Text as="p" variant="headingSm">Analyzing with Gemma 4…</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Scanning product data + {images.length} image{images.length !== 1 ? 's' : ''} for issues
              </Text>
            </BlockStack>
          )}

          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

          {analysis && (
            <BlockStack gap="400">
              {/* Score Cards */}
              <InlineGrid columns={5} gap="200">
                <Card>
                  <BlockStack gap="100" align="center" inlineAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">Overall</Text>
                    <Text as="span" variant="headingXl" fontWeight="bold" tone={
                      analysis.overallScore >= 70 ? 'success' : analysis.overallScore >= 40 ? 'caution' : 'critical'
                    }>{analysis.overallScore}</Text>
                    <Badge tone={
                      analysis.riskLevel === 'LOW' ? 'success' :
                      analysis.riskLevel === 'MEDIUM' ? 'warning' : 'critical'
                    }>{analysis.riskLevel}</Badge>
                  </BlockStack>
                </Card>
                <ScoreCard label="SEO" score={analysis.seoScore} icon="🔍" />
                <ScoreCard label="GEO" score={analysis.geoScore} icon="🌐" />
                <ScoreCard label="Content" score={analysis.contentScore} icon="📝" />
                <ScoreCard label="Image" score={analysis.imageScore} icon="📸" />
              </InlineGrid>

              <Divider />

              {/* All Issues */}
              {analysis.issues.length > 0 && (
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h3" variant="headingMd">Issues Found</Text>
                    <Badge tone="critical">{analysis.issues.length}</Badge>
                  </InlineStack>
                  {analysis.issues.map((issue, i) => (
                    <Box key={i} padding="300" borderRadius="200" background={
                      issue.severity === 'CRITICAL' ? 'bg-surface-critical' :
                      issue.severity === 'HIGH' ? 'bg-surface-caution' : 'bg-surface-secondary'
                    }>
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={severityColor(issue.severity) as any}>{issue.severity}</Badge>
                          {issue.category && <Badge>{issue.category}</Badge>}
                          <Text as="span" variant="bodySm" fontWeight="semibold">{issue.title}</Text>
                        </InlineStack>
                        <Text as="p" variant="bodySm">{issue.detail}</Text>
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              )}

              {analysis.issues.length === 0 && (
                <Banner tone="success"><p>No issues found. This product is well-optimized!</p></Banner>
              )}

              {/* Fixes */}
              {enrichedFixes.length > 0 && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h3" variant="headingMd">One-Click Fixes</Text>
                      <Badge tone="info">{enrichedFixes.length}</Badge>
                    </InlineStack>
                    {enrichedFixes.map((fix, i) => (
                      <Box key={i} background="bg-surface-info" padding="200" borderRadius="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodySm" fontWeight="semibold">{fix.label}</Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {fix.type.replace(/_/g, ' ')} · {fix.field}
                            </Text>
                          </BlockStack>
                          <Button size="slim" variant="primary" onClick={() => onFixClick(fix)}>
                            Preview &amp; Fix
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                </>
              )}

              <InlineStack align="end">
                <Button onClick={runAnalysis} loading={loading}>Re-analyze</Button>
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// ── Product List Card ──
function ProductListCard({ product, onClick }: { product: any; onClick: () => void }) {
  const prices = (product.variants || []).map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p));
  const priceStr = prices.length > 0
    ? (Math.min(...prices) === Math.max(...prices) ? `$${Math.min(...prices)}` : `$${Math.min(...prices)} – $${Math.max(...prices)}`)
    : '—';
  const img = product.images?.[0]?.url || null;

  return (
    <div onClick={onClick} style={{ cursor: 'pointer' }}>
      <Card>
        <InlineStack gap="300" blockAlign="center">
          <div style={{
            width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
            background: 'var(--p-color-bg-fill-secondary)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
              <Text as="span" variant="bodyLg">📦</Text>}
          </div>
          <BlockStack gap="050" align="start">
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{product.title}</Text>
              <Badge tone={product.status === 'ACTIVE' ? 'success' : undefined}>
                {product.status || 'DRAFT'}
              </Badge>
            </InlineStack>
            <InlineStack gap="200">
              {product.vendor && <Text as="span" variant="bodySm" tone="subdued">{product.vendor}</Text>}
              <Text as="span" variant="bodySm" fontWeight="semibold">{priceStr}</Text>
              <Text as="span" variant="bodySm" tone="subdued">{product.total_inventory} in stock</Text>
              <Text as="span" variant="bodySm" tone="subdued">{(product.images || []).length} images</Text>
            </InlineStack>
          </BlockStack>
        </InlineStack>
      </Card>
    </div>
  );
}

// ── Main ProductsPage ──
export const ProductsPage: React.FC = () => {
  const { data, shop, policyReady, refreshData } = useDashboard();
  const catalog = data?.catalog || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFix, setSelectedFix] = useState<FixPayload | null>(null);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const handleFixClick = (fix: FixPayload) => {
    setSelectedFix(fix);
    setFixModalOpen(true);
  };

  const handleFixApplied = (fix: FixPayload) => {
    setAppliedFixes(prev => new Set([...prev, fixKey(fix)]));
  };

  const filtered = catalog.filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q) || p.product_type?.toLowerCase().includes(q);
  });

  return (
    <Page
      title="Products"
      subtitle={`${filtered.length} product${filtered.length !== 1 ? 's' : ''} · Click any product for details & deep analysis`}
      fullWidth
    >
      <BlockStack gap="400">
        <Card>
          <TextField
            label="Search products"
            labelHidden
            placeholder="Search by name, vendor, or type…"
            value={searchQuery}
            onChange={setSearchQuery}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearchQuery('')}
          />
        </Card>

        {!policyReady && (
          <Banner tone="warning">
            <p>Run a GEO Audit from the Overview page first to enable per-product deep analysis.</p>
          </Banner>
        )}

        {appliedFixes.size > 0 && (
          <Banner tone="success">
            <p>{appliedFixes.size} fix{appliedFixes.size > 1 ? 'es' : ''} applied this session.</p>
          </Banner>
        )}

        {filtered.length > 0 ? (
          filtered.map((p: any, i: number) => (
            <ProductListCard
              key={p.id || i}
              product={p}
              onClick={() => handleProductClick(p)}
            />
          ))
        ) : (
          <Card>
            <Box padding="600">
              <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                {searchQuery ? 'No products match your search.' : 'No products found in your store.'}
              </Text>
            </Box>
          </Card>
        )}
      </BlockStack>

      <ProductDetailModal
        open={detailOpen}
        product={selectedProduct}
        shop={shop}
        policyReady={policyReady}
        onClose={() => { setDetailOpen(false); setSelectedProduct(null); }}
        appliedFixes={appliedFixes}
        onFixClick={handleFixClick}
        onFixApplied={handleFixApplied}
      />

      <FixPreviewModal
        open={fixModalOpen}
        fix={selectedFix}
        shop={shop}
        onClose={() => { setFixModalOpen(false); setSelectedFix(null); }}
        onFixed={handleFixApplied}
        refreshData={refreshData}
      />
    </Page>
  );
};
