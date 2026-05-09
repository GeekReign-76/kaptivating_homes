import { NextRequest, NextResponse } from 'next/server';

const KW_BASE = 'https://karstenmiller.kw.com';
const KW_SEARCH = `${KW_BASE}/search/sale`;

/**
 * GET /api/kw-proxy?viewport=lat1,lng1,lat2,lng2
 *
 * Fetches the KW agent search page server-side, strips X-Frame-Options
 * and CSP headers, injects a <base href> so all assets resolve correctly,
 * and returns the HTML so it can be loaded in an iframe on our domain.
 */
export async function GET(req: NextRequest) {
  const viewport = req.nextUrl.searchParams.get('viewport') ?? '';

  const url = viewport
    ? `${KW_SEARCH}?viewport=${encodeURIComponent(viewport)}`
    : KW_SEARCH;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         KW_BASE,
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json({ error: `KW fetch failed: ${res.status}` }, { status: 502 });
    }

    let html = await res.text();

    // Inject base href so all relative URLs (JS, CSS, images, API calls) resolve to KW
    html = html.replace('<head>', `<head><base href="${KW_BASE}/" />`);

    // Return with X-Frame-Options and CSP stripped so our iframe can load it
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // Deliberately omitting X-Frame-Options and Content-Security-Policy
        // so the response can be embedded in our iframe
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
