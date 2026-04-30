import React from 'react';
import { AppShell } from './AppShell';

interface DashboardViewProps {
  data: any;
  onReExtract?: () => void;
  refreshData?: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onReExtract, refreshData }) => {
  return <AppShell data={data} onReExtract={onReExtract} refreshData={refreshData} />;
};
