import React, { useState, useCallback, useEffect } from 'react';
import {
  Page, Card, Text, BlockStack, Box, Banner, Divider, Badge,
  InlineStack, Button, TextField, Modal, Spinner, EmptyState,
  Select, InlineGrid, ProgressBar,
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import {
  analyzeBlog, generateBlog, listBlogs,
  type BlogArticle, type BlogAnalysis, type GeneratedBlog, type ShopifyBlog,
} from '../../../api/blogClient';
import { FixPreviewModal } from '../components/FixPreviewModal';
import type { FixPayload } from '../../../api/fixClient';

// ── Score Badge ──
function ScoreBadge({ label, score }: { label: string; score: number }) {
  const tone = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'critical';
  return (
    <BlockStack gap="100" align="center" inlineAlign="center">
      <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
      <Text as="span" variant="headingMd" fontWeight="bold" tone={tone}>{score}</Text>
    </BlockStack>
  );
}

// ── Blog Analysis Modal ──
function AnalysisModal({ open, article, shop, onClose }: {
  open: boolean;
  article: BlogArticle | null;
  shop: string;
  onClose: () => void;
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
    if (!article) return;
    setLoading(true);
    setError('');
    try {
      const result = await analyzeBlog(shop, token, article);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [article, shop, token]);

  useEffect(() => {
    if (open && article && !analysis) {
      runAnalysis();
    }
  }, [open, article]);

  const handleClose = () => {
    setAnalysis(null);
    setError('');
    setAppliedFixes(new Set());
    onClose();
  };

  const handleFixClick = (fix: FixPayload) => {
    setSelectedFix(fix);
    setFixModalOpen(true);
  };

  const handleFixApplied = (fix: FixPayload) => {
    setAppliedFixes(prev => new Set([...prev, fixKey(fix)]));
  };

  // Enrich fixes with article resource info
  const enrichedFixes = (analysis?.fixes || [])
    .map(f => ({
      ...f,
      resourceId: (f as any).resourceId || article?.id || '',
      resourceTitle: (f as any).resourceTitle || article?.title || '',
    }))
    .filter(f => !appliedFixes.has(fixKey(f)));

  return (
    <>
      <Modal open={open} onClose={handleClose} title={`Analysis: ${article?.title || ''}`} large>
        <Modal.Section>
          {loading && (
            <BlockStack gap="300" align="center" inlineAlign="center">
              <Spinner size="large" />
              <Text as="p" variant="bodySm">Analyzing article with Gemma 4…</Text>
            </BlockStack>
          )}

          {error && <Banner tone="critical"><p>{error}</p></Banner>}

          {analysis && !loading && (
            <BlockStack gap="400">
              {/* Score Cards */}
              <InlineGrid columns={4} gap="300">
                <Card>
                  <ScoreBadge label="Overall" score={analysis.overallScore} />
                </Card>
                <Card>
                  <ScoreBadge label="SEO" score={analysis.seoScore} />
                </Card>
                <Card>
                  <ScoreBadge label="Readability" score={analysis.readabilityScore} />
                </Card>
                <Card>
                  <ScoreBadge label="GEO" score={analysis.geoScore} />
                </Card>
              </InlineGrid>

              <Text as="p" variant="bodySm" tone="subdued">Word count: {analysis.wordCount}</Text>

              <Divider />

              {/* Issues */}
              {analysis.issues.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Issues Found</Text>
                  {analysis.issues.map((issue, i) => (
                    <Box key={i} background="bg-surface-critical" padding="200" borderRadius="200">
                      <Text as="p" variant="bodySm">{issue}</Text>
                    </Box>
                  ))}
                </BlockStack>
              )}

              {/* Suggestions */}
              {analysis.suggestions.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Suggestions</Text>
                  {analysis.suggestions.map((s, i) => (
                    <Box key={i} background="bg-surface-success" padding="200" borderRadius="200">
                      <Text as="p" variant="bodySm">{s}</Text>
                    </Box>
                  ))}
                </BlockStack>
              )}

              {/* Fixes */}
              {enrichedFixes.length > 0 && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h3" variant="headingSm">One-Click Fixes</Text>
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
                          <Button size="slim" variant="primary" onClick={() => handleFixClick(fix)}>
                            Preview &amp; Fix
                          </Button>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                </>
              )}

              {appliedFixes.size > 0 && (
                <Banner tone="success">
                  <p>{appliedFixes.size} fix{appliedFixes.size > 1 ? 'es' : ''} applied.</p>
                </Banner>
              )}

              <InlineStack align="end">
                <Button onClick={runAnalysis} loading={loading}>Re-analyze</Button>
              </InlineStack>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>

      <FixPreviewModal
        open={fixModalOpen}
        fix={selectedFix}
        shop={shop}
        onClose={() => { setFixModalOpen(false); setSelectedFix(null); }}
        onFixed={handleFixApplied}
        refreshData={refreshData}
      />
    </>
  );
}

// ── Create Blog Modal ──
function CreateBlogModal({ open, shop, onClose, onCreated }: {
  open: boolean;
  shop: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [topic, setTopic] = useState('');
  const [blogs, setBlogs] = useState<ShopifyBlog[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedBlog | null>(null);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState('');
  const token = sessionStorage.getItem('shopify_token') || '';

  // Fetch available blogs on open
  useEffect(() => {
    if (open && blogs.length === 0) {
      listBlogs(shop, token).then(b => {
        setBlogs(b);
        if (b.length > 0) setSelectedBlogId(String(b[0].id));
      }).catch(() => {});
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setGenerated(null);
    try {
      const result = await generateBlog(shop, token, topic.trim());
      setGenerated(result.generated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!generated || !selectedBlogId) return;
    setLoading(true);
    setError('');
    try {
      const result = await generateBlog(shop, token, topic.trim(), Number(selectedBlogId));
      if (result.published) {
        setPublished(true);
        setTimeout(() => {
          handleClose();
          onCreated();
        }, 1500);
      } else if (result.publishError) {
        setError(`Publish failed: ${result.publishError}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTopic('');
    setGenerated(null);
    setPublished(false);
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create New Blog Post"
      primaryAction={
        generated
          ? { content: published ? '✓ Published!' : 'Publish as Draft', onAction: handlePublish, loading, disabled: published || !selectedBlogId }
          : { content: 'Generate', onAction: handleGenerate, loading, disabled: !topic.trim() }
      }
      secondaryActions={[{ content: 'Cancel', onAction: handleClose }]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          {!generated ? (
            <>
              <TextField
                label="Blog Topic"
                value={topic}
                onChange={setTopic}
                placeholder="e.g., Best snowboards for beginners in 2026"
                autoComplete="off"
                helpText="Describe the topic — Gemma 4 will generate a complete GEO-optimized blog post"
              />

              {blogs.length > 0 && (
                <Select
                  label="Publish to Blog"
                  options={blogs.map(b => ({ label: b.title, value: String(b.id) }))}
                  value={selectedBlogId}
                  onChange={setSelectedBlogId}
                />
              )}

              {loading && (
                <BlockStack gap="200" align="center" inlineAlign="center">
                  <Spinner size="large" />
                  <Text as="p" variant="bodySm">Generating blog post with Gemma 4… This may take a minute.</Text>
                </BlockStack>
              )}
            </>
          ) : (
            <>
              {published && <Banner tone="success"><p>Blog post published as draft! You can edit it in Shopify.</p></Banner>}

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">{generated.title}</Text>
                  <InlineStack gap="200" wrap>
                    {generated.tags.map((tag, i) => (
                      <Badge key={i}>{tag}</Badge>
                    ))}
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">{generated.metaDescription}</Text>
                  <Divider />
                  <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                    <div
                      style={{ fontSize: 14, lineHeight: 1.7 }}
                      dangerouslySetInnerHTML={{ __html: generated.bodyHtml }}
                    />
                  </Box>
                </BlockStack>
              </Card>

              {blogs.length > 0 && !published && (
                <Select
                  label="Publish to Blog"
                  options={blogs.map(b => ({ label: b.title, value: String(b.id) }))}
                  value={selectedBlogId}
                  onChange={setSelectedBlogId}
                />
              )}
            </>
          )}

          {error && <Banner tone="critical"><p>{error}</p></Banner>}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// ── Main BlogsPage ──
export const BlogsPage: React.FC = () => {
  const { data, shop, refreshData } = useDashboard();
  const blogContent: BlogArticle[] = data?.blog_content || [];

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAnalyze = (article: BlogArticle) => {
    setSelectedArticle(article);
    setAnalysisOpen(true);
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  return (
    <Page
      title="Blog Management"
      subtitle={`${blogContent.length} article${blogContent.length !== 1 ? 's' : ''} found`}
      primaryAction={{ content: '+ Create New Blog', onAction: () => setCreateOpen(true) }}
    >
      <BlockStack gap="500">

        {blogContent.length === 0 ? (
          <Card>
            <EmptyState
              heading="No blog articles found"
              image=""
              action={{ content: 'Create Your First Blog Post', onAction: () => setCreateOpen(true) }}
            >
              <p>Use AI to generate GEO-optimized blog content for your store.</p>
            </EmptyState>
          </Card>
        ) : (
          <BlockStack gap="300">
            {blogContent.map((article, i) => {
              const wc = wordCount(article.body || '');
              const wTone = wc >= 800 ? 'success' : wc >= 300 ? 'warning' : 'critical';
              return (
                <Card key={i}>
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{article.title}</Text>
                        <Badge>{article.blog}</Badge>
                      </InlineStack>
                      <InlineStack gap="300">
                        <Text as="span" variant="bodySm" tone="subdued">By {article.author}</Text>
                        {article.published_at && (
                          <Text as="span" variant="bodySm" tone="subdued">
                            {new Date(article.published_at).toLocaleDateString()}
                          </Text>
                        )}
                        <Badge tone={wTone}>{wc} words</Badge>
                        {article.tags.length > 0 && (
                          <Text as="span" variant="bodySm" tone="subdued">{article.tags.length} tags</Text>
                        )}
                      </InlineStack>
                    </BlockStack>
                    <Button variant="primary" size="slim" onClick={() => handleAnalyze(article)}>
                      Analyze
                    </Button>
                  </InlineStack>
                </Card>
              );
            })}
          </BlockStack>
        )}
      </BlockStack>

      <AnalysisModal
        open={analysisOpen}
        article={selectedArticle}
        shop={shop}
        onClose={() => { setAnalysisOpen(false); setSelectedArticle(null); }}
      />

      <CreateBlogModal
        open={createOpen}
        shop={shop}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRefreshKey(k => k + 1)}
      />
    </Page>
  );
};
