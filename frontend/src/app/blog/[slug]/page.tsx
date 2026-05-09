import type { Metadata } from 'next';
import { notFound }    from 'next/navigation';
import { SiteHeader }  from '@/components/layout/SiteHeader';
import { SiteFooter }  from '@/components/layout/SiteFooter';
import { ChatWidget }  from '@/components/chat/ChatWidget';
import { BlogPost }    from '@/components/blog/BlogPost';
import { apiClient }   from '@/lib/apiClient';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const post = await apiClient.blog.getBySlug(params.slug);
    return {
      title:       post.title,
      description: post.excerpt ?? undefined,
      openGraph: {
        title:  post.title,
        images: post.cover_image_url ? [post.cover_image_url] : [],
      },
    };
  } catch {
    return { title: 'Post Not Found' };
  }
}

export const revalidate = 3600;

export default async function BlogPostPage({ params }: Props) {
  let post;
  try {
    post = await apiClient.blog.getBySlug(params.slug);
  } catch {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main>
        <BlogPost post={post} />
      </main>
      <SiteFooter />
      <ChatWidget />
    </>
  );
}
