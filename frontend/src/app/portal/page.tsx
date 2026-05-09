import { redirect } from 'next/navigation';

// /portal → redirect to messages (primary feature for clients)
export default function PortalPage() {
  redirect('/portal/messages');
}
