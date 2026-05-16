/**
 * /portal/messages — client messaging inbox
 * Lists threads; clicking opens the conversation panel.
 * URL: /portal/messages?thread=<id>
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MessagingPortal } from '@/components/portal/MessagingPortal';

export const metadata: Metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagingPortal />
    </Suspense>
  );
}
