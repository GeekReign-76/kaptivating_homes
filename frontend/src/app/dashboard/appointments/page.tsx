import type { Metadata } from 'next';
import { AppointmentsManager } from '@/components/dashboard/AppointmentsManager';

export const metadata: Metadata = { title: 'Appointments' };

export default function AppointmentsPage() {
  return <AppointmentsManager />;
}
