/**
 * wordpressFeed.ts
 *
 * Fetches and parses Karsten's WordPress.com RSS feed.
 * Called server-side on the blog page (Next.js server component).
 * Cached for 10 minutes via Next.js fetch cache.
 */

// Request up to 20 posts so we always have enough to show
const FEED_URL = 'https://kaptivatinghomesbykarstenblog.wordpress.com/feed/?posts_per_page=20';

export interface WPPost {
  id:                string;
  title:             string;
  slug:              string;
  excerpt:           string;
  content_html:      string;
  cover_image_url:   string | null;
  tags:              string[];
  published_at:      string;
  external_url:      string;
  source:            'wordpress';
  read_time_minutes: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-zA-Z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function estimateReadTime(html: string): number {
  const words = stripHtml(html).split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function unwrapCdata(str: string): string {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/** Extract first value between two string delimiters within a block */
function extractTag(block: string, tag: string): string {
  // Handle both <tag> and <ns:tag> patterns
  const openRe  = new RegExp(`<${tag}[^>]*>`);
  const closeTag = `</${tag}>`;
  const m = openRe.exec(block);
  if (!m) return '';
  const start = m.index + m[0].length;
  const end   = block.indexOf(closeTag, start);
  if (end === -1) return '';
  return unwrapCdata(block.slice(start, end).trim());
}

/** Extract all values for a repeated tag */
function extractAllTags(block: string, tag: string): string[] {
  const results: string[] = [];
  const openRe  = new RegExp(`<${tag}[^>]*>`, 'g');
  const closeTag = `</${tag}>`;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(block)) !== null) {
    const start = m.index + m[0].length;
    const end   = block.indexOf(closeTag, start);
    if (end === -1) break;
    const val = unwrapCdata(block.slice(start, end).trim());
    if (val) results.push(val);
    openRe.lastIndex = end + closeTag.length;
  }
  return results;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function fetchWordPressPosts(): Promise<WPPost[]> {
  try {
    const res = await fetch(FEED_URL, {
      next: { revalidate: 600 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KaptivatingHomes/1.0)' },
    });

    if (!res.ok) return [];

    const xml = await res.text();

    // Split on <item> — avoids </item> being confused by CDATA content
    // Index 0 is the channel header; 1..N are actual items
    const parts = xml.split('<item>');
    if (parts.length < 2) return [];

    const posts: WPPost[] = [];

    for (let i = 1; i < parts.length; i++) {
      // Each part ends with </item> or </channel> — take everything before that
      const block = parts[i].split('</item>')[0];

      const title      = stripHtml(extractTag(block, 'title'));
      const link       = extractTag(block, 'link')
                          // <link> in RSS is sometimes not wrapped in tags but sits bare
                          || block.match(/https?:\/\/[^\s<"]+/)?.[0]
                          || '';
      const pubDate    = extractTag(block, 'pubDate');
      const description = extractTag(block, 'description');
      const contentRaw  = extractTag(block, 'content:encoded');
      const categories  = extractAllTags(block, 'category').filter(Boolean);

      if (!title) continue;

      // Cover image — prefer media:thumbnail url attr, fallback to first <img> in content
      let coverImage: string | null = null;
      const thumbMatch = block.match(/media:thumbnail[^/]* url="([^"]+)"/);
      if (thumbMatch) {
        coverImage = thumbMatch[1];
      } else {
        const imgMatch = contentRaw.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) coverImage = imgMatch[1];
      }

      const content_html     = contentRaw || description;
      const plainDescription = stripHtml(description);
      const excerpt          = plainDescription.length > 220
        ? plainDescription.slice(0, 220).trim() + '…'
        : plainDescription;

      posts.push({
        id:                `wp-${i}-${slugify(title).slice(0, 24)}`,
        title,
        slug:              slugify(title),
        excerpt,
        content_html,
        cover_image_url:   coverImage,
        tags:              categories.slice(0, 3),
        published_at:      pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        external_url:      link,
        source:            'wordpress',
        read_time_minutes: estimateReadTime(content_html),
      });
    }

    return posts;

  } catch {
    return [];
  }
}
