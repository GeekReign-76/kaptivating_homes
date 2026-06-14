import type { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
