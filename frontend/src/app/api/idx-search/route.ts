import { NextRequest, NextResponse } from 'next/server';

const IDX_TOKEN    = 'd95436b2';
const IDX_BASE_URL = 'https://matrix.canopymls.com';
const IDX_INIT_URL = `${IDX_BASE_URL}/Matrix/public/IDX.aspx?idx=${IDX_TOKEN}`;
const IDX_POST_URL = `${IDX_BASE_URL}/Matrix/Public/IDXMap.aspx?L=1&idx=${IDX_TOKEN}`;


/**
 * GET /api/idx-search?zip=28277&city=Charlotte
 *
 * 1. Fetches the IDX page server-side to obtain session cookies + CSRF token
 * 2. POSTs to IDXMap.aspx without the ScriptManager field (forces full postback)
 * 3. Returns the redirect URL so the client can load it directly in the iframe
 */
export async function GET(req: NextRequest) {
  const zip  = req.nextUrl.searchParams.get('zip')  ?? '';
  const city = req.nextUrl.searchParams.get('city') ?? '';

  if (!zip && !city) {
    return NextResponse.json({ error: 'zip or city required' }, { status: 400 });
  }

  try {
    // ── Step 1: Load the IDX page to get session cookies + CSRF token ──────
    const initRes = await fetch(IDX_INIT_URL, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!initRes.ok) {
      return NextResponse.json({ error: `IDX init failed: ${initRes.status}` }, { status: 502 });
    }

    // Extract session cookies from the response
    const rawCookies = initRes.headers.getSetCookie?.() ?? [];
    const cookieHeader = rawCookies
      .map(c => c.split(';')[0]) // keep only name=value, strip flags
      .join('; ');

    // Extract CSRF token from the HTML
    const html = await initRes.text();
    const csrfMatch = html.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] ?? '';

    if (!csrfToken) {
      return NextResponse.json({ error: 'Could not extract CSRF token' }, { status: 502 });
    }

    // ── Step 2: POST to IDXMap.aspx — full postback (no ScriptManager) ──────
    const body = new URLSearchParams({
      idx:                      IDX_TOKEN,
      Fm80_Ctrl102_TextBox:     zip,
      Fm80_Ctrl103_TextBox:     city,
      __RequestVerificationToken: csrfToken,
      mapMLSStatus_105:         '105_3',
      mapMLSStatus_107:         '107_3',
      mapMLSStatus_983:         '983_3',
      mapMLSStatus_106:         '106_3',
    });

    const searchRes = await fetch(IDX_POST_URL, {
      method: 'POST',
      redirect: 'manual', // capture redirect instead of following it
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Referer':       IDX_INIT_URL,
        'Cookie':        cookieHeader,
        'User-Agent':    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin':        IDX_BASE_URL,
      },
      body: body.toString(),
    });

    // ── Step 3: Check for redirect URL ──────────────────────────────────────
    const location = searchRes.headers.get('location');

    if (location) {
      const redirectUrl = location.startsWith('http')
        ? location
        : `${IDX_BASE_URL}${location}`;
      return NextResponse.json({ url: redirectUrl });
    }

    // No redirect — we have the full search results HTML.
    // Inject a <base href> so all relative paths (JS, CSS, images, links)
    // resolve back to the Matrix server. Return the HTML directly to the
    // client so it can create a Blob URL and load it in the iframe.
    const resultHtml = await searchRes.text();

    // Script injected into the proxied page that:
    // 1. Hides the Google Maps error banner (map is domain-restricted)
    // 2. Clicks the List view button so results show without needing the map
    const injectedScript = `
<script>
(function() {
  function switchToListView() {
    // Matrix IDX list view — try common selectors
    var selectors = [
      '[data-resultsmode="1"]',
      '[href*="resultsmode=1"]',
      '.j-listView',
      '[title="List View"]',
      '[aria-label="List View"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) { el.click(); return true; }
    }
    // Fallback: find the second view-mode button (map=1st, list=2nd)
    var viewBtns = document.querySelectorAll('.j-resultsViewBtn, .j-viewModeBtn, [data-view]');
    if (viewBtns.length >= 2) { viewBtns[1].click(); return true; }
    return false;
  }

  // Hide the Google Maps error box
  var style = document.createElement('style');
  style.textContent = '.gm-err-container, .gm-err-content { display: none !important; }';
  document.head.appendChild(style);

  // Try immediately and then keep retrying until it works
  var tries = 0;
  var timer = setInterval(function() {
    if (switchToListView() || ++tries > 20) clearInterval(timer);
  }, 300);
})();
<\/script>`;

    const proxied = resultHtml
      .replace('<head>', `<head><base href="${IDX_BASE_URL}/" />`)
      .replace('</body>', injectedScript + '</body>');

    return new Response(proxied, {
      status: 200,
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
