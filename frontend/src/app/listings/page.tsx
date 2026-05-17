import type { Metadata } from 'next';
import { SiteHeader }       from '@/components/layout/SiteHeader';
import { ChatWidget }        from '@/components/chat/ChatWidget';
import { SaveListingPrompt } from '@/components/listings/SaveListingPrompt';
import { KwSearchPane }      from '@/components/listings/KwSearchPane';

export const metadata: Metadata = {
  title: 'Search Homes for Sale in Charlotte NC',
  description: 'Search homes for sale in Charlotte, NC and surrounding communities — Ballantyne, SouthPark, Steele Creek, Matthews, Huntersville, and more. Powered by Karsten Miller, REALTOR® at Keller Williams Ballantyne.',
  keywords: [
    'homes for sale Charlotte NC',
    'Charlotte NC MLS search',
    'Ballantyne homes for sale',
    'SouthPark Charlotte homes',
    'Steele Creek homes for sale',
    'Matthews NC homes',
    'Huntersville homes for sale',
    'Charlotte NC real estate listings',
  ],
  alternates: { canonical: 'https://kaptivatinghomesbykarsten.com/listings' },
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
