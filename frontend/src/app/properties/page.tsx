import type { Metadata } from 'next';
import { SiteHeader }    from '@/components/layout/SiteHeader';
import { SiteFooter }    from '@/components/layout/SiteFooter';
import { ChatWidget }    from '@/components/chat/ChatWidget';
import { KwListingsGrid } from '@/components/listings/KwListingsGrid';

export const metadata: Metadata = {
  title: 'Active Listings | Keller Williams Ballantyne',
  description: 'Browse active listings from Karsten Miller, REALTOR® at Keller Williams Ballantyne. View current homes for sale in Charlotte, NC and schedule a showing today.',
  keywords: [
    'Keller Williams Ballantyne listings',
    'active listings Charlotte NC',
    'Charlotte NC homes for sale',
    'Karsten Miller listings',
    'schedule a showing Charlotte NC',
  ],
  alternates: { canonical: 'https://kaptivatinghomesbykarsten.com/properties' },
};

export default function PropertiesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <div className="bg-white border-b border-neutral-200 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-wide mb-1">Active Listings</p>
            <h1 className="font-serif text-3xl font-bold text-neutral-900">Keller Williams Ballantyne</h1>
            <p className="text-neutral-500 mt-2 max-w-xl">
              Browse our current listings. Click any property to view details on KW — when you return,
              Karsten will follow up to answer questions or schedule a showing.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <KwListingsGrid />
        </div>
      </main>

      <SiteFooter />
      <ChatWidget />
    </div>
  );
}
