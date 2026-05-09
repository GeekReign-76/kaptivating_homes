import type { Metadata } from 'next';
import { LeadsDashboard } from '@/components/dashboard/LeadsDashboard';

export const metadata: Metadata = { title: 'Leads' };

export default function LeadsPage() {
  return <LeadsDashboard />;
}
