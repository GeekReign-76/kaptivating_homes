/**
 * blog.ts
 *
 * Blog post CRUD.
 * Agent writes via TipTap WYSIWYG — content stored as TipTap JSON + pre-rendered HTML.
 * Published posts are public; drafts are agent-only.
 *
 * Endpoints:
 *   GET    /api/v1/blog              — list published posts (public)
 *   GET    /api/v1/blog/drafts       — list drafts (agent)
 *   GET    /api/v1/blog/:slug        — single post (public if published, agent always)
 *   POST   /api/v1/blog              — create post as draft (agent)
 *   PATCH  /api/v1/blog/:id          — update post (agent)
 *   PATCH  /api/v1/blog/:id/publish  — publish draft (agent)
 *   PATCH  /api/v1/blog/:id/unpublish — revert to draft (agent)
 *   DELETE /api/v1/blog/:id          — soft-delete (agent)
 *   POST   /api/v1/blog/images       — upload image, get back public URL (agent)
 */

import { Router, Request, Response } from 'express';
import { db }                        from '../lib/db';
import { authMiddleware, requireAgent } from '../middleware/auth';

export const blogRouter = Router();

// -------------------------------------------------------------------------
// GET /api/v1/blog — public: list published posts
// -------------------------------------------------------------------------

blogRouter.get('/', async (req: Request, res: Response) => {
  const { tag, page = '1', limit = '12' } = req.query;
  const pageNum  = Math.max(1, parseInt(page  as string, 10));
  const limitNum = Math.min(50, parseInt(limit as string, 10));
  const offset   = (pageNum - 1) * limitNum;

  let query = db
    .from('blog_posts')
    .select('id, title, slug, excerpt, cover_image_url, tags, published_at', { count: 'exact' })
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({
    data,
    error: null,
    meta: { page: pageNum, limit: limitNum, total: count ?? 0 },
  });
});

// -------------------------------------------------------------------------
// GET /api/v1/blog/drafts — agent: list drafts
// -------------------------------------------------------------------------

blogRouter.get('/drafts', authMiddleware, requireAgent, async (_req: Request, res: Response) => {
  const { data, error } = await db
    .from('blog_posts')
    .select('id, title, slug, excerpt, tags, is_published, created_at, updated_at')
    .eq('is_published', false)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data: data ?? [], error: null });
});

// -------------------------------------------------------------------------
// GET /api/v1/blog/:slug — public (published) or agent (any)
// -------------------------------------------------------------------------

blogRouter.get('/:slug', async (req: Request, res: Response) => {
  // Auth is optional here — agent can preview drafts
  let query = db
    .from('blog_posts')
    .select('*')
    .eq('slug', req.params.slug)
    .is('deleted_at', null);

  // Token check via Authorization header (non-blocking — no error if absent)
  const authHeader = req.headers.authorization;
  let isAgent = false;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await db.auth.admin.getUserById(token).catch(() => ({ data: { user: null } }));
    isAgent = user?.user_metadata?.role === 'agent';
  }

  if (!isAgent) {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Post not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/blog — agent creates a draft
// -------------------------------------------------------------------------

blogRouter.post('/', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { title, content, content_html, excerpt, cover_image_url, tags } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'title is required' } });
  }

  const slug = slugify(title);

  const { data, error } = await db
    .from('blog_posts')
    .insert({
      title:           title.trim(),
      slug,
      content:         content         ?? {},
      content_html:    content_html    ?? null,
      excerpt:         excerpt         ?? null,
      cover_image_url: cover_image_url ?? null,
      tags:            tags            ?? [],
      is_published:    false,
    })
    .select()
    .single();

  if (error || !data) {
    return res.status(500).json({
      data:  null,
      error: { code: 'SERVER_ERROR', message: error?.message ?? 'Failed to create post' },
    });
  }

  return res.status(201).json({ data, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/blog/:id — agent updates post (title, content, meta)
// -------------------------------------------------------------------------

blogRouter.patch('/:id', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const allowed = ['title', 'content', 'content_html', 'excerpt', 'cover_image_url', 'tags'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  // Auto-update slug if title changed
  if (updates.title) {
    updates.slug = slugify(updates.title as string);
  }

  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length <= 1) { // only updated_at
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } });
  }

  const { data, error } = await db
    .from('blog_posts')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Post not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/blog/:id/publish
// -------------------------------------------------------------------------

blogRouter.patch('/:id/publish', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('blog_posts')
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('is_published', false)
    .select('id, title, slug, is_published, published_at')
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Draft not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/blog/:id/unpublish
// -------------------------------------------------------------------------

blogRouter.patch('/:id/unpublish', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('blog_posts')
    .update({ is_published: false })
    .eq('id', req.params.id)
    .eq('is_published', true)
    .select('id, title, is_published')
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Published post not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// DELETE /api/v1/blog/:id — soft delete
// -------------------------------------------------------------------------

blogRouter.delete('/:id', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { error } = await db
    .from('blog_posts')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data: { deleted: true }, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/blog/images — TipTap image upload
// Frontend uploads to Supabase Storage directly, then sends the path here
// to get back the public CDN URL to embed in the editor.
// -------------------------------------------------------------------------

blogRouter.post('/images', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { file_path } = req.body;

  if (!file_path) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'file_path is required' } });
  }

  const { data } = db.storage.from('blog-images').getPublicUrl(file_path);

  return res.json({ data: { url: data.publicUrl }, error: null });
});

// -------------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}
