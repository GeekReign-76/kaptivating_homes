'use client';

import { useEffect, useState } from 'react';
import Link      from 'next/link';
import { Plus, Globe, EyeOff, Trash2, Pencil, Clock } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api }      from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';

export function BlogManager() {
  const [published, setPublished] = useState<any[]>([]);
  const [drafts,    setDrafts]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.blog.list({ limit: 50 }), api.blog.drafts()])
      .then(([pubRes, draftRes]: any) => {
        setPublished(pubRes.data ?? pubRes ?? []);
        setDrafts(Array.isArray(draftRes) ? draftRes : []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function unpublish(id: string) {
    await api.blog.unpublish(id);
    const post = published.find((p: any) => p.id === id);
    setPublished(prev => prev.filter((p: any) => p.id !== id));
    if (post) setDrafts(prev => [{ ...post, status: 'draft' }, ...prev]);
  }

  async function publish(id: string) {
    const res = await api.blog.publish(id);
    const post = drafts.find((p: any) => p.id === id);
    setDrafts(prev => prev.filter((p: any) => p.id !== id));
    if (post) setPublished(prev => [{ ...post, ...res, status: 'published' }, ...prev]);
  }

  async function deletePost(id: string, isPublished: boolean) {
    if (!confirm('Delete this post permanently?')) return;
    await api.blog.delete(id);
    if (isPublished) setPublished(prev => prev.filter((p: any) => p.id !== id));
    else             setDrafts(prev => prev.filter((p: any) => p.id !== id));
  }

  function PostRow({ post, isPublished }: { post: any; isPublished: boolean }) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">{post.title}</p>
          <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5">
            {isPublished && post.published_at && <span>{formatDate(post.published_at)}</span>}
            {!isPublished && <span>Last edited {formatDate(post.updated_at ?? post.created_at)}</span>}
            {post.read_time_minutes && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.read_time_minutes} min</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/blog/${post.id}/edit`}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Link>
          </Button>
          {isPublished ? (
            <Button variant="ghost" size="sm" onClick={() => unpublish(post.id)}>
              <EyeOff className="w-3.5 h-3.5 mr-1" /> Unpublish
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => publish(post.id)}>
              <Globe className="w-3.5 h-3.5 mr-1" /> Publish
            </Button>
          )}
          <button onClick={() => deletePost(post.id, isPublished)} className="p-1.5 rounded hover:bg-red-50">
            <Trash2 className="w-4 h-4 text-neutral-400 hover:text-red-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Blog</h1>
        <Button asChild><Link href="/dashboard/blog/new"><Plus className="w-4 h-4 mr-1" /> New Post</Link></Button>
      </div>

      <Tabs defaultValue="published">
        <TabsList className="mb-6">
          <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : (
          <>
            <TabsContent value="published">
              {published.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-sm">No published posts.</div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  {published.map((p: any) => <PostRow key={p.id} post={p} isPublished />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="drafts">
              {drafts.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-sm">
                  No drafts.{' '}
                  <Link href="/dashboard/blog/new" className="text-brand-500 hover:underline">Create one</Link>.
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  {drafts.map((p: any) => <PostRow key={p.id} post={p} isPublished={false} />)}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
