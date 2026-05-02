import React, { useState } from 'react';
import {
  Page, Card, Text, BlockStack, Box, TextField,
  InlineStack, Badge, Button, Banner, Divider, Spinner,
  InlineGrid,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { fetchProductAnalysis } from '../../../api/auditClient';
import { FixPreviewModal } from '../components/FixPreviewModal';
import type { FixPayload } from '../../../api/fixClient';
import { friendlyError } from '../../../utils/friendlyError';
import { filterAlreadyFixed } from '../../../utils/aiFixRegistry';

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

function severityTone(s: string): 'critical' | 'warning' | 'info' | 'success' {
  switch (s?.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    default: return 'success';
  }
}

// ── Score Bar ──
function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'var(--p-color-bg-fill-success)' :
                pct >= 40 ? 'var(--p-color-bg-fill-caution)' :
                'var(--p-color-bg-fill-critical)';
  return (
    <Box>
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">{label}</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold">{score}</Text>
      </InlineStack>
      <div className="axiom-score-track">
        <div className="axiom-score-fill" style={{ background: color, width: `${pct}%` }} />
      </div>
    </Box>
  );
}

// ── Product Detail View ──
function ProductDetail({
  product, shop, policyReady, onBack, appliedFixes, onFixClick, onFixApplied,
}: {
  product: any;
  shop: string;
  policyReady: boolean;
  onBack: () => void;
  appliedFixes: Set<string>;
  onFixClick: (fix: FixPayload) => void;
  onFixApplied: (fix: FixPayload) => void;
}) {
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    } catch (e: any) { setError(friendlyError(e.message)); }
    finally { setLoading(false); }
  };

  const enrichedFixes = filterAlreadyFixed(
    (analysis?.fixes || []).map(f => ({
      ...f,
      resourceId: f.resourceId || product.id,
      resourceTitle: f.resourceTitle || product.title,
    }))
  ).filter(f => !appliedFixes.has(fixKey(f)));

  return (
    <Page title={product.title} backAction={{ onAction: onBack }}
      subtitle={[product.vendor, product.product_type].filter(Boolean).join(' · ')}>
      <BlockStack gap="400">

        {/* ── Product Info ── */}
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'clamp(140px, 25%, 220px) 1fr', gap: 20 }}>
            {/* Image — compact, 4:3 */}
            <div style={{
              borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4',
              background: 'var(--p-color-bg-surface-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {images.length > 0 ? (
                <img src={images[0].url} alt={images[0].altText || product.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--p-color-text-subdued)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  No Image
                </span>
              )}
            </div>

            {/* Details */}
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone={product.status === 'ACTIVE' ? 'success' : undefined}>{product.status || 'DRAFT'}</Badge>
                <Text as="span" variant="headingMd">{priceStr}</Text>
              </InlineStack>

              <Divider />

              {/* Stats — inline with dots */}
              <InlineStack gap="200" blockAlign="center" wrap>
                <Text as="span" variant="bodySm"><strong>{product.total_inventory ?? 0}</strong> inventory</Text>
                <span className="axiom-dot" />
                <Text as="span" variant="bodySm"><strong>{(product.variants || []).length}</strong> variants</Text>
                <span className="axiom-dot" />
                <Text as="span" variant="bodySm"><strong>{images.length}</strong> images</Text>
                <span className="axiom-dot" />
                <Text as="span" variant="bodySm"><strong>{(product.tags || []).length}</strong> tags</Text>
              </InlineStack>

              {product.tags?.length > 0 && (
                <>
                  <Divider />
                  <InlineStack gap="100" wrap>
                    {product.tags.map((tag: string, i: number) => <Badge key={i}>{tag}</Badge>)}
                  </InlineStack>
                </>
              )}

              {product.description && (
                <>
                  <Divider />
                  <Text as="p" variant="bodySm" tone="subdued">
                    {product.description.replace(/\*\*/g, '').replace(/<[^>]*>/g, '').slice(0, 300)}{product.description.length > 300 ? '…' : ''}
                  </Text>
                </>
              )}
            </BlockStack>
          </div>
        </Card>

        {/* Image Thumbnails */}
        {images.length > 1 && (
          <Card>
            <InlineStack gap="200">
              {images.map((img: any, i: number) => (
                <div key={i} style={{
                  width: 52, height: 52, borderRadius: 8, overflow: 'hidden',
                  background: 'var(--p-color-bg-fill-secondary)', flexShrink: 0,
                  border: '1px solid var(--p-color-border-secondary)',
                }}>
                  <img src={img.url} alt={img.altText || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </InlineStack>
          </Card>
        )}

        {/* ── Deep Analysis CTA (compact) ── */}
        {!analysis && !loading && (
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="p" variant="headingSm">Deep Analysis</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Analyze SEO, GEO, content quality, and images with AI
                </Text>
              </BlockStack>
              <Button onClick={runAnalysis} disabled={!policyReady} variant="primary">
                Run Analysis
              </Button>
            </InlineStack>
          </Card>
        )}

        {loading && (
          <Card>
            <Box padding="600">
              <BlockStack gap="200" align="center" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" variant="bodySm">Analyzing… This may take up to a minute.</Text>
              </BlockStack>
            </Box>
          </Card>
        )}

        {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

        {/* ── Analysis Results ── */}
        {analysis && (
          <>
            {/* Scores */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingSm">Analysis Scores</Text>
                    <Badge tone={
                      analysis.overallScore >= 70 ? 'success' :
                      analysis.overallScore >= 40 ? 'warning' : 'critical'
                    }>{analysis.overallScore}/100</Badge>
                    <Badge tone={
                      analysis.riskLevel === 'LOW' ? 'success' :
                      analysis.riskLevel === 'MEDIUM' ? 'warning' : 'critical'
                    }>{analysis.riskLevel}</Badge>
                  </InlineStack>
                  <Button size="slim" onClick={runAnalysis} loading={loading}>Re-analyze</Button>
                </InlineStack>
                <Divider />
                <InlineGrid columns={2} gap="400">
                  <ScoreBar label="SEO" score={analysis.seoScore} />
                  <ScoreBar label="GEO" score={analysis.geoScore} />
                  <ScoreBar label="Content" score={analysis.contentScore} />
                  <ScoreBar label="Image Quality" score={analysis.imageScore} />
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Issues */}
            {analysis.issues.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingSm">Issues</Text>
                    <Badge tone="critical">{analysis.issues.length}</Badge>
                  </InlineStack>
                  <Divider />
                  {analysis.issues.map((issue, i) => (
                    <div key={i} className="axiom-issue-row" style={{
                      padding: 12,
                      background: issue.severity === 'CRITICAL' ? 'var(--p-color-bg-surface-critical)' :
                        issue.severity === 'HIGH' ? 'var(--p-color-bg-surface-caution)' : 'var(--p-color-bg-surface-secondary)',
                    }}>
                      <InlineStack gap="300" blockAlign="start" wrap={false}>
                        <div style={{ flexShrink: 0 }}>
                          <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>
                        </div>
                        <BlockStack gap="100">
                          <Text as="span" variant="bodySm" fontWeight="semibold">{issue.title}</Text>
                          <Text as="span" variant="bodySm" tone="subdued">{issue.detail}</Text>
                        </BlockStack>
                      </InlineStack>
                    </div>
                  ))}
                </BlockStack>
              </Card>
            )}

            {analysis.issues.length === 0 && (
              <Banner tone="success"><p>No issues found — this product is well optimized.</p></Banner>
            )}

            {/* Fixes */}
            {enrichedFixes.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingSm">One-Click Fixes</Text>
                    <Badge tone="info">{enrichedFixes.length}</Badge>
                  </InlineStack>
                  <Divider />
                  {enrichedFixes.map((fix, i) => (
                    <div key={i} className="axiom-issue-row" style={{
                      padding: 12, background: 'var(--p-color-bg-surface-secondary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text as="span" variant="bodySm" fontWeight="semibold">{fix.label}</Text>
                          <div><Text as="span" variant="bodySm" tone="subdued">
                            {fix.type.replace(/_/g, ' ')} · {fix.field}
                          </Text></div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          <Button size="slim" variant="primary" onClick={() => onFixClick(fix)}>
                            Preview &amp; Fix
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </BlockStack>
              </Card>
            )}
          </>
        )}

        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
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
    <div className="axiom-card-interactive" onClick={onClick}>
      <Card>
        <InlineStack gap="300" blockAlign="center">
          <div style={{
            width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
            background: 'var(--p-color-bg-fill-secondary)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--p-color-border-secondary)',
          }}>
            {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--p-color-text-subdued)', textTransform: 'uppercase' }}>N/A</span>}
          </div>
          <BlockStack gap="050" align="start">
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{product.title}</Text>
              <Badge tone={product.status === 'ACTIVE' ? 'success' : undefined}>
                {product.status || 'DRAFT'}
              </Badge>
            </InlineStack>
            <InlineStack gap="100" blockAlign="center">
              {product.vendor && <Text as="span" variant="bodySm" tone="subdued">{product.vendor}</Text>}
              {product.vendor && <span className="axiom-dot" />}
              <Text as="span" variant="bodySm" fontWeight="semibold">{priceStr}</Text>
              <span className="axiom-dot" />
              <Text as="span" variant="bodySm" tone="subdued">{product.total_inventory} in stock</Text>
              <span className="axiom-dot" />
              <Text as="span" variant="bodySm" tone="subdued">{(product.images || []).length} img</Text>
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
  const [selectedFix, setSelectedFix] = useState<FixPayload | null>(null);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const handleFixClick = (fix: FixPayload) => { setSelectedFix(fix); setFixModalOpen(true); };
  const handleFixApplied = (fix: FixPayload) => { setAppliedFixes(prev => new Set([...prev, fixKey(fix)])); };

  const filtered = catalog.filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q) || p.product_type?.toLowerCase().includes(q);
  });

  // Keep selectedProduct synced with latest data (after fix + refreshData)
  React.useEffect(() => {
    if (selectedProduct && catalog.length > 0) {
      const fresh = catalog.find((p: any) => p.id === selectedProduct.id);
      if (fresh && fresh !== selectedProduct) {
        setSelectedProduct(fresh);
      }
    }
  }, [catalog]);

  const handleBack = React.useCallback(() => {
    setSelectedProduct(null);
    refreshData?.();
  }, [refreshData]);

  if (selectedProduct) {
    return (
      <>
        <ProductDetail product={selectedProduct} shop={shop} policyReady={policyReady}
          onBack={handleBack} appliedFixes={appliedFixes}
          onFixClick={handleFixClick} onFixApplied={handleFixApplied} />
        <FixPreviewModal open={fixModalOpen} fix={selectedFix} shop={shop}
          onClose={() => { setFixModalOpen(false); setSelectedFix(null); }}
          onFixed={handleFixApplied} refreshData={refreshData} />
      </>
    );
  }

  return (
    <Page title="Products" subtitle={`${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}>
      <BlockStack gap="400">
        <Card>
          <TextField label="Search products" labelHidden placeholder="Search by name, vendor, or type…"
            value={searchQuery} onChange={setSearchQuery} autoComplete="off"
            clearButton onClearButtonClick={() => setSearchQuery('')} />
        </Card>

        {!policyReady && (
          <Banner tone="warning"><p>Run a GEO Audit from Overview to enable per-product deep analysis.</p></Banner>
        )}

        {appliedFixes.size > 0 && (
          <Banner tone="success"><p>{appliedFixes.size} fix{appliedFixes.size > 1 ? 'es' : ''} applied this session.</p></Banner>
        )}

        <div className="axiom-stagger">
          {filtered.length > 0 ? (
            filtered.map((p: any, i: number) => (
              <ProductListCard key={p.id || i} product={p} onClick={() => setSelectedProduct(p)} />
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
        </div>

        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
};
