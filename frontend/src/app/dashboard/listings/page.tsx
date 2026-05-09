import type { Metadata } from 'next';
import { ListingsManager } from '@/components/dashboard/ListingsManager';

export const metadata: Metadata = { title: 'Manage Listings' };

export default function AgentListingsPage() {
  return <ListingsManager />;
}
