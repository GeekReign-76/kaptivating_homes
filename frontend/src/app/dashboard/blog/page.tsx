import type { Metadata } from 'next';
import { BlogManager } from '@/components/dashboard/BlogManager';

export const metadata: Metadata = { title: 'Blog' };

export default function AgentBlogPage() {
  return <BlogManager />;
}
