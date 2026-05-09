import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { RelocatePage } from '@/components/relocate/RelocatePage';

export const metadata: Metadata = {
  title: 'Relocating to Charlotte | Your Global City',
  description: 'Charlotte is one of America\'s most international cities. Discover your community — Indian, Hispanic, Vietnamese, Korean, African, Filipino, Middle Eastern and more — before you arrive.',
};

export default function Relocate() {
  return (
    <>
      <SiteHeader />
      <main>
        <RelocatePage />
      </main>
      <SiteFooter />
      <ChatWidget />
    </>
  );
}
