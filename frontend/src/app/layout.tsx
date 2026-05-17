import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster }          from '@/components/ui/toaster';
import { TestModeBanner, TestModeToggle } from '@/components/TestModeBanner';
import { GoogleAnalytics }  from '@/components/GoogleAnalytics';
import './globals.css';

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
});

const playfair = Playfair_Display({
  subsets:  ['latin'],
  variable: '--font-playfair',
  display:  'swap',
});

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Kaptivating Homes by Karsten';
const SITE_URL  = 'https://kaptivatinghomesbykarsten.com';
const AGENT     = process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Karsten Miller';

export const metadata: Metadata = {
  title: {
    default:  SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: `${AGENT}, REALTOR® at Keller Williams Ballantyne — helping buyers, sellers, and families relocating to Charlotte, NC find their perfect home.`,
  keywords: [
    'Charlotte NC real estate',
    'homes for sale Charlotte NC',
    'Karsten Miller REALTOR',
    'Keller Williams Ballantyne',
    'relocating to Charlotte',
    'Charlotte NC neighborhoods',
    'luxury homes Charlotte',
    'first time home buyer Charlotte',
  ],
  authors: [{ name: AGENT }],
  creator: AGENT,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  openGraph: {
    type:        'website',
    locale:      'en_US',
    url:         SITE_URL,
    siteName:    SITE_NAME,
    title:       SITE_NAME,
    description: `${AGENT}, REALTOR® — Charlotte NC real estate, relocation specialist, and luxury home expert at Keller Williams Ballantyne.`,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card:        'summary',
    title:       SITE_NAME,
    description: `${AGENT}, REALTOR® — Charlotte NC real estate & relocation specialist.`,
    images:      ['/icons/icon-512.png'],
  },
  robots: {
    index:          true,
    follow:         true,
    googleBot: { index: true, follow: true },
  },
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor:   '#1a6ef5',
  width:        'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-neutral-50 font-sans antialiased">
        <GoogleAnalytics />
        {children}
        <Toaster />
        <TestModeBanner />
        <TestModeToggle />
      </body>
    </html>
  );
}
