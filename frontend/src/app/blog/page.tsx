import type { Metadata } from 'next';
import { SiteHeader }  from '@/components/layout/SiteHeader';
import { SiteFooter }  from '@/components/layout/SiteFooter';
import { BlogList }    from '@/components/blog/BlogList';
import { apiClient }   from '@/lib/apiClient';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Real estate tips, market updates, and local guides.',
};

export const revalidate = 600;

export default async function BlogPage() {
  const { data: posts } = await apiClient.blog.list({ limit: 12 });

  return (
    <>
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold text-neutral-900 mb-10">
          Latest Posts
        </h1>
        <BlogList posts={posts ?? []} />
      </main>
      <SiteFooter />
    </>
  );
}
