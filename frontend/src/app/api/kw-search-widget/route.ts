import { NextResponse } from 'next/server';

/**
 * GET /api/kw-search-widget
 *
 * Returns a self-contained HTML page that renders the KW-style property
 * search bar. Served from our domain so it can be embedded in an iframe
 * without any X-Frame-Options restriction.
 *
 * On submit the search opens karstenmiller.kw.com in a new tab — the user
 * stays on our site with all chat/lead-capture features intact.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const initialQuery = searchParams.get('q') ?? '';
  const bgImages = [
    'https://dims.web.production.kw-prod.brightspot.cloud/dims4/default/a5ae36b/2147483647/strip/true/crop/1200x450+0+90/resize/1280x480!/quality/90/?url=https%3A%2F%2Fstatic.kw.com%2Fe9%2Fca%2Fa2118df64a86b85b3c08b6dc950a%2F2.png',
    'https://dims.web.production.kw-prod.brightspot.cloud/dims4/default/3b3c52b/2147483647/strip/true/crop/1200x450+0+90/resize/1280x480!/quality/90/?url=https%3A%2F%2Fstatic.kw.com%2Fd7%2F90%2Fa57da4b448c2bad83a1b92048126%2F1.png',
    'https://dims.web.production.kw-prod.brightspot.cloud/dims4/default/e24cc04/2147483647/strip/true/crop/1200x450+0+90/resize/1280x480!/quality/90/?url=https%3A%2F%2Fstatic.kw.com%2F8b%2F82%2Fa05419154c81a59fdfe040cd77fa%2F4.png',
    'https://dims.web.production.kw-prod.brightspot.cloud/dims4/default/89a66b6/2147483647/strip/true/crop/1200x450+0+90/resize/1280x480!/quality/90/?url=https%3A%2F%2Fstatic.kw.com%2F7b%2F3a%2F131f45544fad8bfa9bdb7fc5e034%2F3.png',
    'https://dims.web.production.kw-prod.brightspot.cloud/dims4/default/38708e4/2147483647/strip/true/crop/1200x450+0+90/resize/1280x480!/quality/90/?url=https%3A%2F%2Fstatic.kw.com%2F34%2Fec%2F91c7205d4944a872167733bc7b56%2F5.png',
  ];

  const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Search Listings</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Slideshow ──────────────────────────────────────── */
    .hero {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bg-slide {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      opacity: 0;
      transition: opacity 1.2s ease-in-out;
    }
    .bg-slide.active { opacity: 1; }

    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%);
      z-index: 1;
    }

    /* ── Content ────────────────────────────────────────── */
    .content {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 780px;
      padding: 0 24px;
      text-align: center;
    }

    h1 {
      color: #fff;
      font-size: clamp(22px, 4vw, 36px);
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 24px;
      text-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }

    /* ── Type tabs ──────────────────────────────────────── */
    .tabs {
      display: inline-flex;
      gap: 0;
      background: rgba(255,255,255,0.15);
      border-radius: 6px 6px 0 0;
      padding: 4px 4px 0;
      backdrop-filter: blur(4px);
    }

    .tab-label {
      position: relative;
      cursor: pointer;
    }
    .tab-label input { position: absolute; opacity: 0; width: 0; height: 0; }
    .tab-label span {
      display: block;
      padding: 8px 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: rgba(255,255,255,0.75);
      border-radius: 4px 4px 0 0;
      transition: background 0.15s, color 0.15s;
    }
    .tab-label input:checked + span {
      background: #fff;
      color: #1a1a2e;
    }
    .tab-label:hover span { color: #fff; }

    /* ── Search box ─────────────────────────────────────── */
    .search-row {
      display: flex;
      align-items: stretch;
      background: #fff;
      border-radius: 0 6px 6px 6px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    }

    .search-icon {
      display: flex;
      align-items: center;
      padding: 0 14px;
      color: #6b7280;
      flex-shrink: 0;
    }
    .search-icon svg { width: 20px; height: 20px; }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 15px;
      color: #1a1a2e;
      padding: 16px 8px;
      min-width: 0;
    }
    .search-input::placeholder { color: #9ca3af; }

    .search-btn {
      background: #1a1a2e;
      color: #fff;
      border: none;
      padding: 0 28px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.3px;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .search-btn:hover { background: #2d2d4e; }

    /* ── Attribution ────────────────────────────────────── */
    .attribution {
      margin-top: 16px;
      font-size: 12px;
      color: rgba(255,255,255,0.6);
    }
    .attribution a { color: rgba(255,255,255,0.8); text-decoration: none; }
    .attribution a:hover { color: #fff; }
  </style>
</head>
<body>
  <div class="hero" id="hero">
    ${bgImages.map((url, i) => `
    <div class="bg-slide${i === 0 ? ' active' : ''}"
         style="background-image:url('${url}')"
         data-slide="${i}"></div>`).join('')}

    <div class="content">
      <h1>Let's find your dream home</h1>

      <form id="search-form" onsubmit="handleSearch(event)">
        <div class="tabs">
          <label class="tab-label">
            <input type="radio" name="search-type" value="buy" checked />
            <span>BUY</span>
          </label>
          <label class="tab-label">
            <input type="radio" name="search-type" value="rent" />
            <span>RENT</span>
          </label>
        </div>

        <div class="search-row">
          <div class="search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="10.5" cy="10.5" r="7.5"/>
              <line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
          </div>
          <input
            id="search-input"
            class="search-input"
            type="text"
            placeholder="City, Neighborhood, Address, Postal Code"
            autocomplete="off"
            value="${initialQuery.replace(/"/g, '&quot;')}"
          />
          <button class="search-btn" type="submit">Search</button>
        </div>
      </form>

      <p class="attribution">
        Powered by <a href="https://karstenmiller.kw.com" target="_blank" rel="noopener">
          Karsten Miller · Keller Williams
        </a>
      </p>
    </div>
  </div>

  <script>
    // Slideshow
    const slides = document.querySelectorAll('.bg-slide');
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 4500);

    // Search submit
    function handleSearch(e) {
      e.preventDefault();
      const query = document.getElementById('search-input').value.trim();
      if (!query) return;
      const type  = document.querySelector('input[name="search-type"]:checked').value;
      const path  = type === 'rent' ? 'rent' : 'sale';
      const url   = 'https://karstenmiller.kw.com/search/' + path + '?q=' + encodeURIComponent(query);

      // Notify parent so it can capture the search query for lead intelligence
      try {
        window.parent.postMessage({ type: 'kw-search', query, searchType: type, url }, '*');
      } catch(_) {}

      window.open(url, '_blank', 'noopener,noreferrer');
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // No X-Frame-Options — intentionally embeddable since we serve it ourselves
    },
  });
}
