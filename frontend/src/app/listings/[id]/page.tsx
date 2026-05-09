/**
 * /listings/[id] — individual listing detail page
 */

import type { Metadata } from 'next';
import { notFound }          from 'next/navigation';
import { SiteHeader }        from '@/components/layout/SiteHeader';
import { SiteFooter }        from '@/components/layout/SiteFooter';
import { ChatWidget }        from '@/components/chat/ChatWidget';
import { ListingDetail }     from '@/components/listings/ListingDetail';
import { apiClient }         from '@/lib/apiClient';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const listing = await apiClient.listings.getById(params.id);
    return {
      title:       `${listing.address}, ${listing.city}, ${listing.state}`,
      description: listing.description?.slice(0, 160) ?? `${listing.beds} bed / ${listing.baths} bath in ${listing.city}, ${listing.state}`,
    };
  } catch {
    return { title: 'Property Details' };
  }
}

export const revalidate = 300;

export default async function ListingDetailPage({ params }: Props) {
  let listing;
  try {
    listing = await apiClient.listings.getById(params.id);
  } catch {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main>
        <ListingDetail listing={listing} />
      </main>
      <SiteFooter />
      <ChatWidget />
    </>
  );
}
