import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTNAMES = [
  'cflare.smarteragent.com',
  'storage.googleapis.com',
  'media.bridgedataoutput.com',
];

/**
 * GET /api/img-proxy?url=<encoded-image-url>
 *
 * Proxies KW listing images that require a matching Referer/Origin
 * to be served. Without this, Next.js image optimizer fetches them
 * server-side with no Referer and gets blocked.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  // Only proxy known KW / MLS CDN hostnames
  if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
    return new NextResponse('Hostname not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KaptivatingHomes/1.0)',
        Referer: 'https://karstenmiller.kw.com/',
        Origin:  'https://karstenmiller.kw.com',
      },
      // Don't follow too many redirects
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    console.error('[img-proxy] fetch error:', err);
    return new NextResponse('Proxy error', { status: 502 });
  }
}
