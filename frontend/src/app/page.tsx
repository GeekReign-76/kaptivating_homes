import type { Metadata } from 'next';

const SITE_URL = 'https://kaptivatinghomesbykarsten.com';

export const metadata: Metadata = {
  title: 'Charlotte NC Real Estate | Karsten Miller, REALTOR®',
  description: 'Search homes for sale in Charlotte, NC with Karsten Miller, REALTOR® at Keller Williams Ballantyne. Buyer representation, seller strategy, and relocation services.',
  keywords: [
    'Charlotte NC real estate agent',
    'homes for sale Charlotte NC',
    'Karsten Miller REALTOR',
    'Keller Williams Ballantyne agent',
    'buy a home Charlotte NC',
    'sell my home Charlotte NC',
    'Charlotte NC housing market',
    'first time home buyer Charlotte',
    'luxury homes Charlotte NC',
    'relocation specialist Charlotte',
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    url:         SITE_URL,
    title:       'Charlotte NC Real Estate | Karsten Miller, REALTOR®',
    description: 'Search homes for sale in Charlotte, NC. Karsten Miller, REALTOR® at Keller Williams Ballantyne — buyer, seller, and relocation specialist.',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Kaptivating Homes by Karsten' }],
  },
};

import { HeroSection }      from '@/components/home/HeroSection';
import { FeaturedListings } from '@/components/home/FeaturedListings';
import { AboutSection }     from '@/components/home/AboutSection';
import { BlogPreview }      from '@/components/home/BlogPreview';
import { ContactSection }   from '@/components/home/ContactSection';
import { SiteHeader }       from '@/components/layout/SiteHeader';
import { SiteFooter }       from '@/components/layout/SiteFooter';
import { ChatWidget }       from '@/components/chat/ChatWidget';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <FeaturedListings />
        <AboutSection />
        <BlogPreview />
        <ContactSection />
      </main>
      <SiteFooter />
      <ChatWidget />
    </>
  );
}
