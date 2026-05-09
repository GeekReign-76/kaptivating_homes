/**
 * /dashboard/blog/[id]/edit  — TipTap editor for existing posts
 * /dashboard/blog/new        — handled by redirect below
 */

import type { Metadata } from 'next';
import { BlogEditor }   from '@/components/dashboard/BlogEditor';

interface Props {
  params: { id: string };
}

export const metadata: Metadata = { title: 'Edit Post' };

export default function EditPostPage({ params }: Props) {
  return <BlogEditor postId={params.id} />;
}
