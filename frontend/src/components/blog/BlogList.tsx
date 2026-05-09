import Link          from 'next/link';
import Image         from 'next/image';
import { Badge }     from '@/components/ui/badge';
import { Clock }     from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface BlogListProps { posts: any[] }

export function BlogList({ posts }: BlogListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20 text-neutral-400">
        <p>No posts published yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {posts.map((post: any) => (
        <article key={post.id} className="group">
          <Link href={`/blog/${post.slug}`}>
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
                <div className="absolute inset-0 bg-gradient-to-br from-brand-100 to-brand-200" />
              )}
            </div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {(post.tags ?? []).slice(0, 2).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <h2 className="font-serif font-bold text-neutral-900 text-xl leading-snug group-hover:text-brand-600 transition-colors mb-2">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{post.excerpt}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              {post.read_time_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {post.read_time_minutes} min read
                </span>
              )}
              {post.published_at && <span>{formatDate(post.published_at)}</span>}
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
