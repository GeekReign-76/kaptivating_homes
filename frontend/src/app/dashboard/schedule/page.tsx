import type { Metadata } from 'next';
import { ScheduleManager } from '@/components/dashboard/ScheduleManager';

export const metadata: Metadata = { title: 'Schedule' };

export default function SchedulePage() {
  return <ScheduleManager />;
}
