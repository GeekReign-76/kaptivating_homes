/**
 * import-wp-posts.mjs
 *
 * One-time script: imports 7 WordPress blog posts into the blog_posts table.
 * Run from the backend directory:
 *   node import-wp-posts.mjs
 *
 * Uses the service role key (bypasses RLS) so no agent login is needed.
 * Posts are inserted as 'published' with their original publish dates.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('Run from the backend directory: node import-wp-posts.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function estimateReadTime(html) {
  const words = html.replace(/<[^>]+>/g, '').split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function unescapeHtml(str) {
  const map = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#8211;': '-', '&#8212;': '--', '&#8216;': "'", '&#8217;': "'",
    '&#8220;': '"', '&#8221;': '"', '&nbsp;': ' ', '&hellip;': '...',
  };
  return str.replace(/&[^;]+;/g, (e) => map[e] !== undefined ? map[e] : e);
}

async function fetchPost(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KaptivatingHomes/1.0)' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching ' + url);
  return res.text();
}

function getMeta(html, prop) {
  const re = new RegExp('property="' + prop + '" content="([^"]+)"');
  const m = html.match(re);
  return m ? unescapeHtml(m[1]) : '';
}

function getContentHtml(html) {
  const patterns = [
    /class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<footer/,
    /class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*sharedaddy/,
    /class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*post-share/,
    /class="[^"]*entry-content[^"]*"[^>]*>([\s\S]+)/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1].trim().length > 200) {
      return m[1]
        .replace(/<div[^>]*class="[^"]*jp-relatedposts[^"]*"[\s\S]*?<\/div>/gi, '')
        .replace(/<div[^>]*class="[^"]*sharedaddy[^"]*"[\s\S]*?<\/div>/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  return '';
}

function getTagsForPost(title, excerpt) {
  const text = (title + ' ' + excerpt).toLowerCase();
  const tags = [];
  if (/sell|seller|list|price|market|spring|window/.test(text))  tags.push('selling');
  if (/buy|buyer|inspection|pre-approval|mortgage/.test(text))   tags.push('buying');
  if (/bedroom|decor|design|hosting|style|restful|guest/.test(text)) tags.push('home tips');
  if (/social security|retire|financial|benefit/.test(text))     tags.push('financial tips');
  if (tags.length === 0) tags.push('real estate tips');
  return tags.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Posts to import
// ---------------------------------------------------------------------------

const POST_URLS = [
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/06/16/the-polite-house-hostingguests-2-2/',              date: '2026-06-16T08:00:00Z' },
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/06/11/why-you-dont-want-to-skip-your-home-inspection/',  date: '2026-06-11T08:00:00Z' },
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/05/28/dont-miss-this-prime-spring-window-to-sell-your-house/', date: '2026-05-28T08:00:00Z' },
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/05/25/strategies-to-optimize-your-social-security-benefits/', date: '2026-05-25T08:00:00Z' },
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/05/24/pre-approval-isnt-commitment-its-clarity/',         date: '2026-05-24T08:00:00Z' },
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/05/23/10-restful-and-stylish-new-bedrooms/',              date: '2026-05-23T08:00:00Z' },
  { url: 'https://kaptivatinghomesbykarstenblog.wordpress.com/2026/05/20/if-the-asking-price-isnt-compelling-its-not-selling/', date: '2026-05-20T08:00:00Z' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Importing ' + POST_URLS.length + ' posts into blog_posts...\n');

  for (const { url, date } of POST_URLS) {
    try {
      const html    = await fetchPost(url);
      const title   = getMeta(html, 'og:title');
      const img     = getMeta(html, 'og:image');
      const excerpt = getMeta(html, 'og:description');
      const content = getContentHtml(html);
      const tags    = getTagsForPost(title, excerpt);
      const rt      = content ? estimateReadTime(content) : 3;
      const slug    = slugify(title);

      if (!title) {
        console.warn('  SKIP -- no title found for ' + url);
        continue;
      }

      // Check if slug already exists to avoid duplicates
      const { data: existing } = await db
        .from('blog_posts')
        .select('id, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        console.log('  SKIP -- "' + title + '" already exists (slug: ' + slug + ')');
        continue;
      }

      const { data, error } = await db
        .from('blog_posts')
        .insert({
          title,
          slug,
          excerpt:         excerpt || null,
          cover_image_url: img     || null,
          content:         {},
          content_html:    content || null,
          tags,
          is_published:    true,
          published_at:    date,
        })
        .select('id, slug')
        .single();

      if (error) {
        console.error('  ERROR -- "' + title + '": ' + error.message);
      } else {
        console.log('  OK    [' + rt + 'min] "' + title + '" -> /blog/' + data.slug);
      }

    } catch (err) {
      console.error('  FAIL  ' + url + ': ' + err.message);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
