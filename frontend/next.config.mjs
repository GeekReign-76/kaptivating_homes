/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow Supabase Storage and common real estate image CDNs
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Bridge Interactive / RESO media URLs
        protocol: 'https',
        hostname: 'media.bridgedataoutput.com',
      },
      {
        // Common MLS image CDN
        protocol: 'https',
        hostname: '*.mlspin.com',
      },
      {
        // Unsplash (used by mock data)
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Karsten's existing site assets (CloudFront CDN)
        protocol: 'https',
        hostname: 'd3euvzua2sc52.cloudfront.net',
      },
      {
        // WordPress.com hosted blog images
        protocol: 'https',
        hostname: '*.wordpress.com',
      },
      {
        // Keeping Current Matters (KCM) content images used in Karsten's blog
        protocol: 'https',
        hostname: 'files.keepingcurrentmatters.com',
      },
      {
        // KW listing photos served via Cloudflare SmartAgent CDN
        protocol: 'https',
        hostname: 'cflare.smarteragent.com',
      },
      {
        // GCS bucket backing KW/SmartAgent listing media (direct, publicly readable)
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/slp5-stream-listing-media-prod/**',
      },
    ],
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL:           process.env.NEXT_PUBLIC_API_URL           ?? 'http://localhost:7381',
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? '',
    NEXT_PUBLIC_AGENT_NAME:        process.env.NEXT_PUBLIC_AGENT_NAME        ?? '',
  },

  // Reduce bundle size — only import used Radix primitives
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      'lucide-react',
    ],
  },
};

export default nextConfig;
