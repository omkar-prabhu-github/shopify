import { createContext, useContext } from 'react';

export interface DashboardContextType {
  data: any;
  shop: string;
  audit: any;
  auditLoading: boolean;
  auditError: string;
  policyReady: boolean;
  cachedAudit: any;
  runFullAudit: () => Promise<void>;
  clearAudit: () => void;
  clearError: () => void;
  onReExtract?: () => void;
  refreshData?: () => Promise<void>;
  navigate: (path: string) => void;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardContext');
  return ctx;
}
