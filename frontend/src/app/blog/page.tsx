import type { Metadata } from 'next';
import { SiteHeader }          from '@/components/layout/SiteHeader';
import { SiteFooter }          from '@/components/layout/SiteFooter';
import { BlogList }            from '@/components/blog/BlogList';
import { apiClient }           from '@/lib/apiClient';
import { fetchWordPressPosts } from '@/lib/wordpressFeed';

export const metadata: Metadata = {
  title: 'Charlotte NC Real Estate Blog | Karsten Miller',
  description: 'Real estate tips, Charlotte NC market updates, neighborhood guides, and relocation advice from Karsten Miller, REALTOR® at Keller Williams Ballantyne.',
  keywords: [
    'Charlotte NC real estate blog',
    'Charlotte housing market updates',
    'home buying tips Charlotte NC',
    'home selling tips Charlotte NC',
    'Charlotte NC neighborhood guides',
    'Karsten Miller blog',
    'relocating to Charlotte tips',
  ],
  alternates: { canonical: 'https://kaptivatinghomesbykarsten.com/blog' },
};

export const revalidate = 600;

export default async function BlogPage() {
  // Fetch both sources in parallel
  const [{ data: inAppPosts }, wpPosts] = await Promise.all([
    apiClient.blog.list({ limit: 24 }).catch(() => ({ data: [] })),
    fetchWordPressPosts(),
  ]);

  // Merge and sort by date descending
  const allPosts = [
    ...(inAppPosts ?? []),
    ...wpPosts,
  ].sort((a, b) => {
    const dateA = new Date(a.published_at ?? 0).getTime();
    const dateB = new Date(b.published_at ?? 0).getTime();
    return dateB - dateA;
  });

  return (
    <>
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold text-neutral-900 mb-3">
          Latest Posts
        </h1>
        <p className="text-neutral-500 mb-10">
          Market insights, buyer &amp; seller tips, and community guides from Karsten Miller, REALTOR®
        </p>
        <BlogList posts={allPosts} />
      </main>
      <SiteFooter />
    </>
  );
}
