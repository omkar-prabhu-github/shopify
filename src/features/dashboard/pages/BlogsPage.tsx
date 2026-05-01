import React, { useState, useCallback, useEffect } from 'react';
import {
  Page, Card, Text, BlockStack, Box, Banner, Divider, Badge,
  InlineStack, Button, TextField, Spinner, EmptyState,
  Select, InlineGrid,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import {
  analyzeBlog, generateBlog, listBlogs, publishBlog,
  type BlogArticle, type BlogAnalysis, type GeneratedBlog, type ShopifyBlog,
} from '../../../api/blogClient';
import { FixPreviewModal } from '../components/FixPreviewModal';
import type { FixPayload } from '../../../api/fixClient';
import { filterAlreadyFixed } from '../../../utils/aiFixRegistry';

// Helper: normalize tags
function normTags(tags: any): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string' && tags.trim()) return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
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
        <Text as="span" variant="bodySm" fontWeight="semibold">{score}/{max}</Text>
      </InlineStack>
      <div className="axiom-score-track">
        <div className="axiom-score-fill" style={{ background: color, width: `${pct}%` }} />
      </div>
    </Box>
  );
}

// ── Blog Detail View ──
function BlogDetail({
  article, shop, onBack, refreshData,
}: {
  article: BlogArticle;
  shop: string;
  onBack: () => void;
  refreshData?: () => Promise<void>;
}) {
  const [analysis, setAnalysis] = useState<BlogAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFix, setSelectedFix] = useState<FixPayload | null>(null);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());
  const token = sessionStorage.getItem('shopify_token') || '';
  const fixKey = (f: FixPayload) => `${f.type}::${f.field}::${f.label}`;

  const runAnalysis = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await analyzeBlog(shop, token, article);
      setAnalysis(result);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [article, shop, token]);

  const enrichedFixes = filterAlreadyFixed(
    (analysis?.fixes || [])
      .map(f => ({
        ...f,
        resourceId: (f as any).resourceId || (article as any).id || '',
        resourceTitle: (f as any).resourceTitle || article.title || '',
      }))
  ).filter(f => !appliedFixes.has(fixKey(f)));

  const tags = normTags(article.tags);
  const wordCount = article.body ? article.body.split(/\s+/).filter(Boolean).length : 0;

  return (
    <Page title={article.title} backAction={{ onAction: onBack }}>
      <BlockStack gap="400">

        {/* Article Info */}
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center" wrap>
              <Badge>{article.blog}</Badge>
              <span className="axiom-dot" />
              <Text as="span" variant="bodySm" tone="subdued">By {article.author}</Text>
              {article.published_at && (
                <>
                  <span className="axiom-dot" />
                  <Text as="span" variant="bodySm" tone="subdued">
                    {new Date(article.published_at).toLocaleDateString()}
                  </Text>
                </>
              )}
              <span className="axiom-dot" />
              <Text as="span" variant="bodySm">{wordCount} words</Text>
              <span className="axiom-dot" />
              <Badge tone={article.published_at ? 'success' : undefined}>
                {article.published_at ? 'Published' : 'Draft'}
              </Badge>
            </InlineStack>

            {tags.length > 0 && (
              <>
                <Divider />
                <InlineStack gap="100" wrap>
                  {tags.map((tag, i) => <Badge key={i}>{tag}</Badge>)}
                </InlineStack>
              </>
            )}

            {article.body && (
              <>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  {article.body.replace(/<[^>]*>/g, '').slice(0, 300)}{article.body.length > 300 ? '…' : ''}
                </Text>
              </>
            )}
          </BlockStack>
        </Card>

        {/* Deep Analysis CTA */}
        {!analysis && !loading && (
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="p" variant="headingSm">Blog Analysis</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Analyze SEO, readability, and GEO optimization with Gemma 4
                </Text>
              </BlockStack>
              <Button variant="primary" onClick={runAnalysis}>Run Analysis</Button>
            </InlineStack>
          </Card>
        )}

        {loading && (
          <Card>
            <Box padding="600">
              <BlockStack gap="200" align="center" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" variant="bodySm">Analyzing with Gemma 4…</Text>
              </BlockStack>
            </Box>
          </Card>
        )}

        {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

        {analysis && !loading && (
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
                  </InlineStack>
                  <Button size="slim" onClick={runAnalysis} loading={loading}>Re-analyze</Button>
                </InlineStack>
                <Divider />
                <InlineGrid columns={3} gap="400">
                  <ScoreBar label="SEO" score={analysis.seoScore} />
                  <ScoreBar label="Readability" score={analysis.readabilityScore} />
                  <ScoreBar label="GEO" score={analysis.geoScore} />
                </InlineGrid>
                <Text as="p" variant="bodySm" tone="subdued">Word count: {analysis.wordCount}</Text>
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
                      padding: 12, background: 'var(--p-color-bg-surface-critical)',
                    }}>
                      <Text as="p" variant="bodySm">{issue}</Text>
                    </div>
                  ))}
                </BlockStack>
              </Card>
            )}

            {/* Suggestions */}
            {analysis.suggestions.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">Suggestions</Text>
                  <Divider />
                  {analysis.suggestions.map((s, i) => (
                    <div key={i} className="axiom-issue-row" style={{
                      padding: 12, background: 'var(--p-color-bg-surface-secondary)',
                    }}>
                      <Text as="p" variant="bodySm">{s}</Text>
                    </div>
                  ))}
                </BlockStack>
              </Card>
            )}

            {analysis.issues.length === 0 && analysis.suggestions.length === 0 && (
              <Banner tone="success"><p>No issues found — this article is well optimized.</p></Banner>
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
                          <Button size="slim" variant="primary" onClick={() => { setSelectedFix(fix); setFixModalOpen(true); }}>
                            Preview &amp; Fix
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </BlockStack>
              </Card>
            )}

            {appliedFixes.size > 0 && (
              <Banner tone="success">
                <p>{appliedFixes.size} fix{appliedFixes.size > 1 ? 'es' : ''} applied.</p>
              </Banner>
            )}
          </>
        )}

        <Box paddingBlockEnd="800" />
      </BlockStack>

      <FixPreviewModal
        open={fixModalOpen} fix={selectedFix} shop={shop}
        onClose={() => { setFixModalOpen(false); setSelectedFix(null); }}
        onFixed={(fix) => setAppliedFixes(prev => new Set([...prev, fixKey(fix)]))}
        refreshData={refreshData}
      />
    </Page>
  );
}

// ── Create Blog View ──
function CreateBlogView({ shop, onBack, onCreated }: {
  shop: string;
  onBack: () => void;
  onCreated: () => Promise<void>;
}) {
  const [topic, setTopic] = useState('');
  const [blogs, setBlogs] = useState<ShopifyBlog[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedBlog | null>(null);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState('');
  const token = sessionStorage.getItem('shopify_token') || '';

  useEffect(() => {
    listBlogs(shop, token).then(b => {
      setBlogs(b);
      if (b.length > 0) setSelectedBlogId(String(b[0].id));
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setGenerated(null);
    try {
      const result = await generateBlog(shop, token, topic.trim());
      setGenerated(result.generated);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handlePublish = async () => {
    if (!generated || !selectedBlogId) return;
    setLoading(true); setError('');
    try {
      const result = await publishBlog(shop, token, Number(selectedBlogId), generated);
      if (result.published) {
        setPublished(true);
        // First refresh data (waits for re-extraction), then navigate back
        await onCreated();
        setTimeout(() => onBack(), 800);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Page title="Create New Blog Post" backAction={{ onAction: onBack }}>
      <BlockStack gap="400">
        {!generated ? (
          <>
            <Card>
              <BlockStack gap="300">
                <TextField label="Blog Topic" value={topic} onChange={setTopic}
                  placeholder="e.g., Best snowboards for beginners in 2026" autoComplete="off"
                  helpText="Describe the topic — Gemma 4 will generate a complete GEO-optimized blog post" />
                {blogs.length > 0 && (
                  <Select label="Publish to Blog"
                    options={blogs.map(b => ({ label: b.title, value: String(b.id) }))}
                    value={selectedBlogId} onChange={setSelectedBlogId} />
                )}
              </BlockStack>
            </Card>
            <InlineStack align="end">
              <Button variant="primary" size="large" onClick={handleGenerate}
                loading={loading} disabled={!topic.trim()}>
                Generate Blog Post
              </Button>
            </InlineStack>
            {loading && (
              <Card>
                <Box padding="600">
                  <BlockStack gap="200" align="center" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p" variant="bodySm">Generating with Gemma 4… This may take a minute.</Text>
                  </BlockStack>
                </Box>
              </Card>
            )}
          </>
        ) : (
          <>
            {published && <Banner tone="success"><p>Blog post published successfully!</p></Banner>}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">{generated.title}</Text>
                <InlineStack gap="100" wrap>
                  {generated.tags.map((tag, i) => <Badge key={i}>{tag}</Badge>)}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">{generated.metaDescription}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">Article Preview</Text>
                <Divider />
                <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--p-color-text)' }}
                  dangerouslySetInnerHTML={{ __html: generated.bodyHtml }} />
              </BlockStack>
            </Card>
            {!published && (
              <Card>
                <BlockStack gap="300">
                  {blogs.length > 0 && (
                    <Select label="Publish to Blog"
                      options={blogs.map(b => ({ label: b.title, value: String(b.id) }))}
                      value={selectedBlogId} onChange={setSelectedBlogId} />
                  )}
                  <InlineStack align="end">
                    <Button variant="primary" size="large" onClick={handlePublish}
                      loading={loading} disabled={!selectedBlogId}>
                      Publish Now
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            )}
          </>
        )}
        {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}
        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
}

// ── Main BlogsPage ──
export const BlogsPage: React.FC = () => {
  const { data, shop, refreshData } = useDashboard();
  const blogContent: BlogArticle[] = data?.blog_content || [];
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);
  const [createMode, setCreateMode] = useState(false);

  const handleBackFromDetail = React.useCallback(() => {
    setSelectedArticle(null);
    refreshData?.();
  }, [refreshData]);

  const handleBackFromCreate = React.useCallback(() => {
    setCreateMode(false);
    refreshData?.();
  }, [refreshData]);

  const handleCreated = React.useCallback(async () => {
    await refreshData?.();
  }, [refreshData]);

  if (selectedArticle) {
    return <BlogDetail article={selectedArticle} shop={shop}
      onBack={handleBackFromDetail} refreshData={refreshData} />;
  }

  if (createMode) {
    return <CreateBlogView shop={shop} onBack={handleBackFromCreate}
      onCreated={handleCreated} />;
  }

  return (
    <Page title="Blogs" subtitle={`${blogContent.length} article${blogContent.length !== 1 ? 's' : ''}`}
      primaryAction={{ content: 'Create New Post', onAction: () => setCreateMode(true) }}>
      <BlockStack gap="400">
        {blogContent.length === 0 ? (
          <Card>
            <Box padding="800">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'var(--p-color-bg-fill-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>📝</div>
                <Text as="p" variant="headingSm">No blog articles found</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Use AI to generate GEO-optimized blog content for your store.
                </Text>
                <Box paddingBlockStart="200">
                  <Button variant="primary" size="large" onClick={() => setCreateMode(true)}>
                    Create Your First Blog Post
                  </Button>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        ) : (
          <div className="axiom-stagger">
            {blogContent.map((article, i) => {
              const wc = article.body ? article.body.split(/\s+/).filter(Boolean).length : 0;
              const wTone = wc >= 800 ? 'success' as const : wc >= 300 ? 'warning' as const : 'critical' as const;
              const tags = normTags(article.tags);

              return (
                <div key={i} className="axiom-card-interactive" onClick={() => setSelectedArticle(article)}>
                  <Card>
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{article.title}</Text>
                        <InlineStack gap="100" blockAlign="center">
                          <Badge>{article.blog}</Badge>
                          <span className="axiom-dot" />
                          <Text as="span" variant="bodySm" tone="subdued">By {article.author}</Text>
                          {article.published_at && (
                            <>
                              <span className="axiom-dot" />
                              <Text as="span" variant="bodySm" tone="subdued">
                                {new Date(article.published_at).toLocaleDateString()}
                              </Text>
                            </>
                          )}
                          <span className="axiom-dot" />
                          <Badge tone={wTone}>{wc} words</Badge>
                          {tags.length > 0 && (
                            <>
                              <span className="axiom-dot" />
                              <Text as="span" variant="bodySm" tone="subdued">{tags.length} tags</Text>
                            </>
                          )}
                        </InlineStack>
                      </BlockStack>
                      <Button variant="primary" size="slim"
                        onClick={(e) => { e.stopPropagation?.(); setSelectedArticle(article); }}>
                        Analyze
                      </Button>
                    </InlineStack>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
};
