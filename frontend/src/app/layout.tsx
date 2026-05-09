import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster }          from '@/components/ui/toaster';
import { TestModeBanner, TestModeToggle } from '@/components/TestModeBanner';
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

export const metadata: Metadata = {
  title: {
    default:  process.env.NEXT_PUBLIC_SITE_NAME ?? 'Kaptivating Homes',
    template: `%s | ${process.env.NEXT_PUBLIC_SITE_NAME ?? 'Kaptivating Homes'}`,
  },
  description: `${process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Your Agent'} — Licensed Real Estate Agent`,
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
        {children}
        <Toaster />
        <TestModeBanner />
        <TestModeToggle />
      </body>
    </html>
  );
}
