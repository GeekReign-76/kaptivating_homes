import Image         from 'next/image';
import Link          from 'next/link';
import { Badge }     from '@/components/ui/badge';
import { Clock, ChevronLeft } from 'lucide-react';
import { formatDate }         from '@/lib/utils';

interface BlogPostProps { post: any }

export function BlogPost({ post }: BlogPostProps) {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-700 mb-8">
        <ChevronLeft className="w-4 h-4" /> All Posts
      </Link>

      {/* Cover */}
      {post.cover_image_url && (
        <div className="relative aspect-[21/9] rounded-2xl overflow-hidden mb-8">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
            priority
          />
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {post.tags.map((tag: string) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-900 leading-snug mb-4">
        {post.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-neutral-400 mb-10 pb-6 border-b border-neutral-100">
        <span>{process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Your Agent'}</span>
        {post.published_at && <span>{formatDate(post.published_at)}</span>}
        {post.read_time_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" /> {post.read_time_minutes} min read
          </span>
        )}
      </div>

      {/* Body */}
      {post.content_html ? (
        <div
          className="tiptap-content"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      ) : post.excerpt ? (
        <p className="text-neutral-600 leading-relaxed text-lg">{post.excerpt}</p>
      ) : null}

      {/* Author box */}
      <div className="mt-14 pt-8 border-t border-neutral-100 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl shrink-0">
          {(process.env.NEXT_PUBLIC_AGENT_NAME ?? 'A').charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-neutral-900">{process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Your Agent'}</p>
          <p className="text-sm text-neutral-500">{process.env.NEXT_PUBLIC_AGENT_TITLE ?? 'Real Estate Agent'}</p>
        </div>
      </div>
    </article>
  );
}
