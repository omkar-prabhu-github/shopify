import React, { useState, useEffect, useCallback } from 'react';
import { Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack, Tabs, Box, Divider, InlineGrid, ProgressBar } from '@shopify/polaris';
import JsonView from '@uiw/react-json-view';
import { analyzeStore, type AuditResult, type AuditFinding } from '../lib/audit';
import { AlertTriangle, AlertCircle, Info, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

interface DashboardViewProps { data: any; }

/* ── Audit Card ───────────────────────────────────────── */
const sevCfg: Record<string, { icon: React.ReactNode; tone: 'critical'|'warning'|'info' }> = {
  High: { icon: <AlertTriangle className="w-4 h-4 text-[#d82c0d]" />, tone: 'critical' },
  Medium: { icon: <AlertCircle className="w-4 h-4 text-[#8a6116]" />, tone: 'warning' },
  Low: { icon: <Info className="w-4 h-4 text-[#004777]" />, tone: 'info' },
};

const AuditCard: React.FC<{ f: AuditFinding }> = ({ f }) => {
  const [open, setOpen] = useState(false);
  const c = sevCfg[f.severity] || sevCfg.Low;
  
  return (
    <Box paddingBlockStart="300" paddingBlockEnd="300">
      <InlineStack align="start" gap="300" wrap={false}>
        <Box paddingBlockStart="050">{c.icon}</Box>
        <BlockStack gap="100">
          <InlineStack align="start" gap="200" blockAlign="center">
            <Text as="h4" variant="bodyMd" fontWeight="semibold">{f.title}</Text>
            <Badge tone={c.tone}>{f.severity}</Badge>
            <Text as="span" variant="bodySm" tone="subdued">{f.category}</Text>
          </InlineStack>
          
          {f.productId !== 'Global' && f.productId && (
            <Text as="p" variant="bodySm" tone="subdued">{f.productId}</Text>
          )}
          
          <Text as="p" variant="bodyMd">{f.explanation}</Text>
          
          {f.fix_suggestion && (
            <Box paddingBlockStart="100">
              <Button variant="plain" onClick={() => setOpen(!open)}>
                {open ? 'Hide suggestion' : 'View suggestion'}
              </Button>
            </Box>
          )}
          
          {f.fix_suggestion && open && (
            <Box paddingBlockStart="200">
              <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="025">
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="bold">Suggested Fix: </Text>
                  {f.fix_suggestion}
                </Text>
              </Box>
            </Box>
          )}
        </BlockStack>
      </InlineStack>
    </Box>
  );
};

/* ── Main Dashboard ───────────────────────────────────── */
export const DashboardView: React.FC<DashboardViewProps> = ({ data }) => {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);

  const ctx = data?.store_context || {};
  const catalog = data?.catalog || [];
  const collections = data?.collections || [];
  const discounts = data?.discounts || [];
  const blogs = data?.blog_content || [];
  const policies = ctx?.native_policies || {};
  const totalInv = catalog.reduce((s: number, p: any) => s + (p.total_inventory || 0), 0);
  const activeProducts = catalog.filter((p: any) => p.status === 'ACTIVE').length;

  useEffect(() => {
    setLoading(true);
    analyzeStore(data).then(r => { setAudit(r); setLoading(false); }).catch(e => { console.error(e); setAudit({ health_score: 0, summary: 'Audit failed: ' + e.message, findings: [], modelResults: [] }); setLoading(false); });
  }, [data]);

  const highC = audit?.findings.filter(f => f.severity === 'High').length || 0;
  const contraC = audit?.findings.filter(f => f.category === 'Contradiction').length || 0;
  const mismatchC = audit?.findings.filter(f => f.category === 'Mismatch').length || 0;
  const complianceC = audit?.findings.filter(f => f.category === 'Compliance').length || 0;

  const policyScore = Math.max(0, 100 - contraC * 20);
  const dataScore = Math.max(0, 100 - mismatchC * 15);
  const compScore = Math.max(0, 100 - complianceC * 25);
  const catalogScore = catalog.length > 0 ? Math.min(100, Math.round((activeProducts / catalog.length) * 100)) : 100;
  const contentScore = Math.min(100, 40 + blogs.length * 10 + Object.keys(policies).length * 15);

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'findings', content: `Findings${audit ? ` (${audit.findings.length})` : ''}` },
    { id: 'models', content: 'Model Comparison' },
    { id: 'data', content: 'Raw Data' },
  ];

  const handleTabChange = useCallback((selectedTabIndex: number) => setSelectedTab(selectedTabIndex), []);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'store_data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      title="Store Dashboard"
      primaryAction={{ content: 'Export Data', onAction: handleDownload }}
    >
      <Box paddingBlockEnd="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {/* ═══ OVERVIEW TAB ═══ */}
            {selectedTab === 0 && (
              <Layout>
                <Layout.Section>
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
                        <Text as="p" variant="bodySm" tone="subdued">{discounts.length} discounts</Text>
                      </BlockStack>
                    </Card>
                  </InlineGrid>
                </Layout.Section>

                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Store Health Score</Text>
                      {loading ? (
                        <Box padding="600">
                          <Text as="p" alignment="center" tone="subdued">Analyzing with 3 AI models…</Text>
                        </Box>
                      ) : audit && (
                        <BlockStack gap="400" align="center" inlineAlign="center">
                          <div className="flex flex-col items-center">
                            <Text as="h1" variant="heading3xl" fontWeight="bold">{audit.health_score}</Text>
                            <Box paddingBlockStart="100">
                              <Badge tone={audit.health_score >= 80 ? 'success' : audit.health_score >= 60 ? 'warning' : 'critical'}>
                                {audit.health_score >= 80 ? 'Excellent' : audit.health_score >= 60 ? 'Fair' : 'Critical'} Score
                              </Badge>
                            </Box>
                          </div>
                          <Text as="p" alignment="center" tone="subdued">{audit.summary}</Text>
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>
                </Layout.Section>

                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Parameter Scores</Text>
                      {loading ? (
                        <Box padding="600"><Text as="p" alignment="center" tone="subdued">Loading parameters...</Text></Box>
                      ) : (
                        <BlockStack gap="300">
                          <BlockStack gap="100">
                            <InlineStack align="space-between"><Text as="span" variant="bodyMd">Policy Consistency</Text><Text as="span" variant="bodyMd" tone="subdued">{policyScore}%</Text></InlineStack>
                            <ProgressBar progress={policyScore} tone="success" size="small" />
                          </BlockStack>
                          <BlockStack gap="100">
                            <InlineStack align="space-between"><Text as="span" variant="bodyMd">Data Integrity</Text><Text as="span" variant="bodyMd" tone="subdued">{dataScore}%</Text></InlineStack>
                            <ProgressBar progress={dataScore} tone="success" size="small" />
                          </BlockStack>
                          <BlockStack gap="100">
                            <InlineStack align="space-between"><Text as="span" variant="bodyMd">Compliance Safety</Text><Text as="span" variant="bodyMd" tone="subdued">{compScore}%</Text></InlineStack>
                            <ProgressBar progress={compScore} tone="success" size="small" />
                          </BlockStack>
                          <BlockStack gap="100">
                            <InlineStack align="space-between"><Text as="span" variant="bodyMd">Catalog Health</Text><Text as="span" variant="bodyMd" tone="subdued">{catalogScore}%</Text></InlineStack>
                            <ProgressBar progress={catalogScore} tone="success" size="small" />
                          </BlockStack>
                          <BlockStack gap="100">
                            <InlineStack align="space-between"><Text as="span" variant="bodyMd">Content Richness</Text><Text as="span" variant="bodyMd" tone="subdued">{contentScore}%</Text></InlineStack>
                            <ProgressBar progress={contentScore} tone="success" size="small" />
                          </BlockStack>
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>
                </Layout.Section>

                {/* Quick Insights */}
                {!loading && audit && audit.findings.length > 0 && (
                  <Layout.Section>
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Top Issues</Text>
                          <Button variant="plain" onClick={() => setSelectedTab(1)}>View all</Button>
                        </InlineStack>
                        <BlockStack gap="0">
                          {audit.findings.filter(f => f.severity === 'High').slice(0, 3).map((f, i) => (
                            <Box key={`high-${i}`} paddingBlockEnd={i < 2 ? "300" : "0"} borderBlockEndWidth={i < 2 ? "025" : "0"} borderColor="border">
                              <AuditCard f={f} />
                            </Box>
                          ))}
                          {highC === 0 && audit.findings.slice(0, 3).map((f, i) => (
                            <Box key={`all-${i}`} paddingBlockEnd={i < 2 ? "300" : "0"} borderBlockEndWidth={i < 2 ? "025" : "0"} borderColor="border">
                              <AuditCard f={f} />
                            </Box>
                          ))}
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                )}
              </Layout>
            )}

            {/* ═══ FINDINGS TAB ═══ */}
            {selectedTab === 1 && (
              <Layout>
                <Layout.Section>
                  {loading ? (
                    <Card>
                      <Box padding="1000">
                        <Text as="p" alignment="center" tone="subdued">Running multi-model audit…</Text>
                      </Box>
                    </Card>
                  ) : audit && audit.findings.length > 0 ? (
                    <Card>
                      <BlockStack gap="400">
                        <Text as="h2" variant="headingMd">All Findings</Text>
                        <BlockStack gap="0">
                          {audit.findings.map((f, i) => (
                            <Box key={i} borderBlockEndWidth={i !== audit.findings.length - 1 ? "025" : "0"} borderColor="border">
                              <AuditCard f={f} />
                            </Box>
                          ))}
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  ) : (
                    <Card>
                      <Box padding="1000">
                        <BlockStack gap="300" inlineAlign="center">
                          <ShieldCheck className="w-10 h-10 text-[#008060] mx-auto" />
                          <Text as="p" variant="headingMd" alignment="center">No issues found.</Text>
                          <Text as="p" alignment="center" tone="subdued">Your store looks perfectly healthy!</Text>
                        </BlockStack>
                      </Box>
                    </Card>
                  )}
                </Layout.Section>
              </Layout>
            )}

            {/* ═══ MODELS TAB ═══ */}
            {selectedTab === 2 && (
              <Layout>
                <Layout.Section>
                  {loading ? (
                     <Card>
                      <Box padding="1000">
                        <Text as="p" alignment="center" tone="subdued">Waiting for all models to respond…</Text>
                      </Box>
                    </Card>
                  ) : audit && (() => {
                    const modelData = audit.modelResults.map(mr => {
                      const findings = audit.findings.filter(f => f.detected_by === mr.modelId);
                      const mHigh = findings.filter(f => f.severity === 'High').length;
                      const mMed = findings.filter(f => f.severity === 'Medium').length;
                      const mLow = findings.filter(f => f.severity === 'Low').length;
                      let score = 100 - mHigh * 15 - mMed * 7 - mLow * 3;
                      score = Math.max(0, Math.min(100, score));
                      return { ...mr, findings, mHigh, mMed, mLow, score };
                    });

                    return (
                    <BlockStack gap="400">
                      <Card>
                        <BlockStack gap="400">
                          <Text as="h2" variant="headingMd">Model Responses</Text>
                          <BlockStack gap="0">
                            {modelData.map((m, i) => (
                              <Box key={m.modelId} paddingBlockEnd={i !== modelData.length - 1 ? "400" : "0"} borderBlockEndWidth={i !== modelData.length - 1 ? "025" : "0"} borderColor="border">
                                <Box paddingBlockStart={i !== 0 ? "400" : "0"}>
                                  <InlineStack align="start" gap="300" wrap={false}>
                                    <Box paddingBlockStart="050">
                                      {m.status === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#008060]" /> : <XCircle className="w-5 h-5 text-[#d82c0d]" />}
                                    </Box>
                                    <BlockStack gap="100">
                                      <InlineStack align="start" gap="200" blockAlign="center">
                                        <Text as="h3" variant="headingSm">{m.modelId}</Text>
                                        {m.status === 'success' && <Badge tone="info">{m.findings.length} findings</Badge>}
                                      </InlineStack>
                                      {m.status === 'success' ? (
                                        <Text as="p" variant="bodyMd" tone="subdued">
                                          Found {m.mHigh} high, {m.mMed} medium, and {m.mLow} low severity issues.
                                        </Text>
                                      ) : (
                                        <Text as="p" variant="bodyMd" tone="critical">{m.error || 'Failed to respond'}</Text>
                                      )}
                                    </BlockStack>
                                  </InlineStack>
                                </Box>
                              </Box>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </Card>

                      <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                        {modelData.map(m => (
                          <Card key={m.modelId}>
                            <BlockStack gap="400" align="center" inlineAlign="center">
                              <Text as="h3" variant="headingSm">{m.modelId}</Text>
                              {m.status === 'success' ? (
                                <div className="flex flex-col items-center">
                                  <Text as="h1" variant="headingXl" fontWeight="bold">{m.score}</Text>
                                  <div className="flex justify-center gap-3 text-[13px] mt-4">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#d82c0d]" />{m.mHigh}</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#8a6116]" />{m.mMed}</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#004777]" />{m.mLow}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center py-4">
                                  <XCircle className="w-8 h-8 text-[#d82c0d] mb-2" />
                                  <Text as="p" tone="critical">Failed</Text>
                                </div>
                              )}
                            </BlockStack>
                          </Card>
                        ))}
                      </InlineGrid>
                    </BlockStack>
                    );
                  })()}
                </Layout.Section>
              </Layout>
            )}

            {/* ═══ RAW DATA TAB ═══ */}
            {selectedTab === 3 && (
              <Layout>
                <Layout.Section>
                  <Card>
                    <div className="bg-[#f4f6f8] text-[#202223] p-4 rounded-[4px] border border-[#ebeef0] overflow-auto max-h-[70vh]">
                      <JsonView value={data} displayDataTypes={false} collapsed={2}
                        style={{ '--w-rjv-background-color': 'transparent', '--w-rjv-color': '#202223', '--w-rjv-key-string': '#2c6ecb', '--w-rjv-info-color': '#6d7175' } as React.CSSProperties} />
                    </div>
                  </Card>
                </Layout.Section>
              </Layout>
            )}
          </Box>
        </Tabs>
      </Box>
    </Page>
  );
};
