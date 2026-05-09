import type { Metadata } from 'next';
import { SiteHeader }      from '@/components/layout/SiteHeader';
import { ChatWidget }      from '@/components/chat/ChatWidget';
import { IdxSearchBanner }   from '@/components/listings/IdxSearchBanner';
import { IdxPreFilter }      from '@/components/listings/IdxPreFilter';
import { SaveListingPrompt } from '@/components/listings/SaveListingPrompt';

export const metadata: Metadata = {
  title: 'Search Properties | Kaptivating Homes by Karsten',
  description: 'Browse homes for sale in Charlotte, NC and surrounding communities with Karsten Miller, REALTOR®.',
};

export default function ListingsPage({
  searchParams,
}: {
  searchParams: { city?: string; zip?: string };
}) {
  const city = searchParams.city?.trim();
  const zip  = searchParams.zip?.trim();

  return (
    <div className="flex flex-col h-screen">
      <SiteHeader />

      <main className="flex-1 min-h-0 relative">
        <IdxPreFilter />
        {zip && <IdxSearchBanner zip={zip} />}
        {/* Delay Save button when banner is present so it doesn't compete with the overlay */}
        <SaveListingPrompt delayMs={zip ? 9000 : 0} />
      </main>

      <ChatWidget />
    </div>
  );
}
