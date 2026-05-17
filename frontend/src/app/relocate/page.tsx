import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { RelocatePage } from '@/components/relocate/RelocatePage';

const SITE_URL = 'https://kaptivatinghomesbykarsten.com';

export const metadata: Metadata = {
  title: 'Relocating to Charlotte NC | International Community Guide',
  description: 'Moving to Charlotte, NC? Karsten Miller, REALTOR® helps international families and professionals relocate with confidence. Explore Indian, Hispanic, Asian, African, and Middle Eastern communities in Charlotte.',
  keywords: [
    'relocating to Charlotte NC',
    'moving to Charlotte NC',
    'Charlotte NC relocation guide',
    'international communities Charlotte NC',
    'Indian community Charlotte NC',
    'Hispanic community Charlotte',
    'Asian community Charlotte NC',
    'Charlotte NC neighborhoods for families',
    'Charlotte NC new resident guide',
    'relocation REALTOR Charlotte NC',
    'Karsten Miller relocation specialist',
    'moving from abroad to Charlotte',
    'Charlotte NC diversity neighborhoods',
    'best neighborhoods Charlotte NC',
    'Ballantyne relocation',
    'SouthPark Charlotte homes',
    'Steele Creek Charlotte',
    'Matthews NC homes',
    'Huntersville NC relocation',
  ],
  alternates: { canonical: `${SITE_URL}/relocate` },
  openGraph: {
    type:        'article',
    url:         `${SITE_URL}/relocate`,
    title:       'Relocating to Charlotte NC | International Community Guide',
    description: 'Explore Charlotte\'s diverse international communities and find your neighborhood before you arrive. Karsten Miller, REALTOR® — your Charlotte relocation specialist.',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Relocating to Charlotte NC' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Relocating to Charlotte NC | International Community Guide',
    description: 'Moving to Charlotte? Discover the city\'s international communities with relocation specialist Karsten Miller, REALTOR®.',
    images:      ['/icons/icon-512.png'],
  },
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
