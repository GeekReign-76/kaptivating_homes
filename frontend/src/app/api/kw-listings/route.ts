import { NextRequest, NextResponse } from 'next/server';
import STATIC_LISTINGS from './kw-listings-cache.json';

/**
 * GET /api/kw-listings
 *
 * Returns Karsten's active KW listings.
 * Serves a static cache parsed from karstenmiller.kw.com.
 * Update kw-listings-cache.json whenever listings change.
 *
 * Photo URLs from cflare.smarteragent.com require a KW Referer to load,
 * so we rewrite them to go through /api/img-proxy which spoofs that header.
 */

export const revalidate = false; // static — no revalidation needed

const PROXY_HOSTNAMES = ['cflare.smarteragent.com', 'storage.googleapis.com'];

function proxyPhotoUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (PROXY_HOSTNAMES.includes(hostname)) {
      return `/api/img-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // malformed URL — return as-is
  }
  return url;
}

export async function GET(_req: NextRequest) {
  const listings = (STATIC_LISTINGS as any[]).map((l) => ({
    ...l,
    photos: (l.photos ?? []).map((p: { url: string }) => ({
      ...p,
      url: proxyPhotoUrl(p.url),
    })),
  }));

  return NextResponse.json({ data: listings, error: null });
}
