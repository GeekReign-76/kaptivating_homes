import Link          from 'next/link';
import Image         from 'next/image';
import { Badge }     from '@/components/ui/badge';
import { ArrowRight, Clock } from 'lucide-react';
import { fetchWordPressPosts } from '@/lib/wordpressFeed';
import { formatDate }          from '@/lib/utils';

export async function BlogPreview() {
  const wpPosts = await fetchWordPressPosts();
  const posts   = wpPosts.slice(0, 3);

  if (posts.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-wide mb-1">Insights</p>
            <h2 className="font-serif text-3xl font-bold text-neutral-900">From The Blog</h2>
          </div>
          <Link href="/blog" className="hidden sm:flex items-center gap-1 text-sm text-brand-500 hover:text-brand-700 font-medium">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article key={post.id} className="group">
              <Link
                href={post.external_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-100 mb-4">
                  {post.cover_image_url ? (
                    <Image
                      src={post.cover_image_url}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-brand-100" />
                  )}
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {post.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
                <h3 className="font-serif font-bold text-neutral-900 text-lg leading-snug group-hover:text-brand-600 transition-colors mb-2">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {post.read_time_minutes} min read
                  </span>
                  <span>{formatDate(post.published_at)}</span>
                </div>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link href="/blog" className="text-sm text-brand-500 hover:text-brand-700 font-medium flex items-center justify-center gap-1">
            View All Posts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
