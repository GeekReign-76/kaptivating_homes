import type { Metadata } from 'next';
import { AppointmentsPortal } from '@/components/portal/AppointmentsPortal';

export const metadata: Metadata = { title: 'My Appointments' };

export default function AppointmentsPage() {
  return <AppointmentsPortal />;
}
