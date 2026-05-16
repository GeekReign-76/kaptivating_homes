import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AgentMessaging } from '@/components/dashboard/AgentMessaging';

export const metadata: Metadata = { title: 'Messages' };

export default function AgentMessagesPage() {
  return (
    <Suspense>
      <AgentMessaging />
    </Suspense>
  );
}
