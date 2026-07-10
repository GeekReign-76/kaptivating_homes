import { NextRequest, NextResponse } from 'next/server';
import STATIC_LISTINGS from './kw-listings-cache.json';

/**
 * GET /api/kw-listings
 *
 * Returns Karsten's active KW listings.
 * Serves a static cache parsed from karstenmiller.kw.com.
 * Update kw-listings-cache.json whenever listings change.
 *
 * Photo URLs from cflare.smarteragent.com are signature-protected (403 externally),
 * so we extract the inner GCS URL which is publicly readable.
 */

export const revalidate = false; // static — no revalidation needed

/**
 * The cflare.smarteragent.com Resizer is signature-protected (sig_id) and returns 403
 * for non-KW origins. However, the inner `url` query param points directly to GCS,
 * which is publicly accessible. Extract and use that instead.
 */
function resolvePhotoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'cflare.smarteragent.com') {
      const inner = parsed.searchParams.get('url');
      if (inner) return inner; // raw GCS URL — publicly accessible
    }
  } catch {
    // malformed — return as-is
  }
  return url;
}

export async function GET(_req: NextRequest) {
  const listings = (STATIC_LISTINGS as any[]).map((l) => ({
    ...l,
    photos: (l.photos ?? []).map((p: { url: string }) => ({
      ...p,
      url: resolvePhotoUrl(p.url),
    })),
  }));

  return NextResponse.json({ data: listings, error: null });
}
