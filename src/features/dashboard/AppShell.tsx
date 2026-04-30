import React, { useState, useEffect, useCallback } from 'react';
import { Frame, Tabs, Page, Box } from '@shopify/polaris';
import { useStoreAudit } from './hooks/useStoreAudit';
import { DashboardContext } from './DashboardContext';
import { OverviewPage } from './pages/OverviewPage';
import { ProductsPage } from './pages/ProductsPage';
import { ActionsPage } from './pages/ActionsPage';
import { BlogsPage } from './pages/BlogsPage';

const TABS = [
  { id: '/', content: 'Overview' },
  { id: '/actions', content: 'Actions' },
  { id: '/products', content: 'Products' },
  { id: '/blogs', content: 'Blogs' },
];

interface AppShellProps {
  data: any;
  onReExtract?: () => void;
  refreshData?: () => Promise<void>;
}

export const AppShell: React.FC<AppShellProps> = ({ data, onReExtract, refreshData }) => {
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.slice(2);
    return '/' + (hash || '');
  });

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.slice(2);
      setRoute('/' + (hash || ''));
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = '#' + path;
  }, []);

  const ctx = data?.store_context || {};
  const shop = sessionStorage.getItem('shopify_shop') || ctx?.domain || '';
  const auditState = useStoreAudit(shop);

  const selectedTab = TABS.findIndex(t => t.id === route);

  const contextValue = {
    data,
    shop,
    audit: auditState.audit,
    auditLoading: auditState.loading,
    auditError: auditState.error,
    policyReady: auditState.policyReady,
    cachedAudit: auditState.cachedAudit,
    runFullAudit: auditState.runFullAudit,
    clearAudit: auditState.clearAudit,
    clearError: auditState.clearError,
    onReExtract,
    refreshData,
    navigate,
  };

  const renderPage = () => {
    switch (route) {
      case '/products': return <ProductsPage />;
      case '/actions': return <ActionsPage />;
      case '/blogs': return <BlogsPage />;
      default: return <OverviewPage />;
    }
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <Frame>
        <div style={{ borderBottom: '1px solid var(--p-color-border)' }}>
          <Box paddingInlineStart="400" paddingInlineEnd="400">
            <Tabs
              tabs={TABS}
              selected={selectedTab >= 0 ? selectedTab : 0}
              onSelect={(idx) => navigate(TABS[idx].id)}
              fitted
            />
          </Box>
        </div>
        {renderPage()}
      </Frame>
    </DashboardContext.Provider>
  );
};
