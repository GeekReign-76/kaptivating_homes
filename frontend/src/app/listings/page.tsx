import type { Metadata } from 'next';
import { SiteHeader }       from '@/components/layout/SiteHeader';
import { ChatWidget }        from '@/components/chat/ChatWidget';
import { SaveListingPrompt } from '@/components/listings/SaveListingPrompt';
import { KwSearchPane }      from '@/components/listings/KwSearchPane';

export const metadata: Metadata = {
  title: 'Search Properties | Kaptivating Homes by Karsten',
  description: 'Browse homes for sale in Charlotte, NC and surrounding communities with Karsten Miller, REALTOR®.',
};

export default function ListingsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const initialQuery = searchParams.q?.trim() ?? '';

  return (
    <div className="flex flex-col h-screen">
      <SiteHeader />

      <main className="flex-1 min-h-0 relative">
        <KwSearchPane initialQuery={initialQuery} />
        <SaveListingPrompt delayMs={initialQuery ? 9000 : 0} />
      </main>

      <ChatWidget />
    </div>
  );
}
