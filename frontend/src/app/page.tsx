/**
 * Home page — public marketing landing page.
 *
 * Sections:
 *   - Hero with search bar
 *   - Featured listings carousel
 *   - About the agent
 *   - Services / value props
 *   - Recent blog posts
 *   - Contact / live chat CTA
 */

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
