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

const NEIGHBORHOODS = [
  { name: 'Ballantyne',    q: 'Ballantyne Charlotte NC'    },
  { name: 'SouthPark',     q: 'SouthPark Charlotte NC'     },
  { name: 'Steele Creek',  q: 'Steele Creek Charlotte NC'  },
  { name: 'Matthews',      q: 'Matthews NC'                },
  { name: 'Huntersville',  q: 'Huntersville NC'            },
  { name: 'Mint Hill',     q: 'Mint Hill NC'               },
  { name: 'Concord',       q: 'Concord NC'                 },
  { name: 'Mooresville',   q: 'Mooresville NC'             },
];

export default function ListingsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const initialQuery = searchParams.q?.trim() ?? '';

  return (
    <div className="flex flex-col h-screen">
      <SiteHeader />

      {/* Static content for SEO — visible to Google before iframe loads */}
      <div className="bg-white border-b border-neutral-200 px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-serif text-2xl font-bold text-neutral-900 mb-1">
            Search Homes for Sale in Charlotte, NC
          </h1>
          <p className="text-neutral-500 text-sm mb-4">
            Browse active listings across Charlotte and surrounding communities with Karsten Miller, REALTOR® at Keller Williams Ballantyne. Search by neighborhood, zip code, price, or address.
          </p>
          <div className="flex flex-wrap gap-2">
            {NEIGHBORHOODS.map(({ name, q }) => (
              <a
                key={name}
                href={`/listings?q=${encodeURIComponent(q)}`}
                className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 hover:bg-brand-50 hover:text-brand-600 transition-colors"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 min-h-0 relative">
        <KwSearchPane initialQuery={initialQuery} />
        <SaveListingPrompt delayMs={initialQuery ? 9000 : 0} />
      </main>

      <ChatWidget />
    </div>
  );
}
