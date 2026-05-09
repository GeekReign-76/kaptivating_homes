/**
 * documents.ts
 *
 * Document library — agent uploads PDFs (disclosures, reports, guides)
 * that can be shared with clients directly via the messaging system.
 *
 * Endpoints:
 *   GET    /api/v1/documents           — list all documents (agent) or shared (client)
 *   POST   /api/v1/documents           — upload metadata after Supabase Storage upload (agent)
 *   DELETE /api/v1/documents/:id       — soft-delete document (agent)
 *   GET    /api/v1/documents/:id/download — generate signed download URL
 *
 * File storage: Supabase Storage bucket 'documents' (private).
 * Frontend uploads directly to Supabase Storage, then calls POST /documents
 * to register the metadata in the DB.
 */

import { Router, Request, Response } from 'express';
import { db }                        from '../lib/db';
import { authMiddleware, requireAgent } from '../middleware/auth';

export const documentsRouter = Router();

// -------------------------------------------------------------------------
// GET /api/v1/documents
// Agent sees all; client sees only documents explicitly shared with them
// via a message in their thread.
// -------------------------------------------------------------------------

documentsRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (req.user!.role === 'agent') {
    const { data, error } = await db
      .from('documents')
      .select('*')
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });

    if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
    return res.json({ data: data ?? [], error: null });
  }

  // For clients: return documents shared with them via messages
  const { data, error } = await db
    .from('messages')
    .select(`
      metadata,
      doc:documents ( id, name, file_name, file_size_bytes, uploaded_at )
    `)
    .eq('message_type', 'pdf')
    .eq('threads.client_id', req.user!.id)
    .not('doc', 'is', null)
    .order('sent_at', { ascending: false });

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  const docs = (data ?? []).map((r: any) => r.doc).filter(Boolean);
  return res.json({ data: docs, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/documents — register document after frontend Storage upload
// -------------------------------------------------------------------------

documentsRouter.post('/', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { name, file_name, file_path, file_size_bytes, mime_type } = req.body;

  if (!name || !file_name || !file_path) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'name, file_name, and file_path are required' },
    });
  }

  const { data, error } = await db
    .from('documents')
    .insert({
      name,
      file_name,
      file_path,
      file_size_bytes: file_size_bytes ?? null,
      mime_type:       mime_type       ?? 'application/pdf',
    })
    .select()
    .single();

  if (error || !data) {
    return res.status(500).json({
      data:  null,
      error: { code: 'SERVER_ERROR', message: error?.message ?? 'Failed to register document' },
    });
  }

  return res.status(201).json({ data, error: null });
});

// -------------------------------------------------------------------------
// DELETE /api/v1/documents/:id — agent soft-deletes
// -------------------------------------------------------------------------

documentsRouter.delete('/:id', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { error } = await db
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.json({ data: { deleted: true }, error: null });
});

// -------------------------------------------------------------------------
// GET /api/v1/documents/:id/download — signed Supabase Storage URL
// Valid for 60 seconds — not stored, generated fresh each request.
// -------------------------------------------------------------------------

documentsRouter.get('/:id/download', authMiddleware, async (req: Request, res: Response) => {
  const { data: doc, error: docError } = await db
    .from('documents')
    .select('id, file_path, file_name')
    .eq('id', req.params.id)
    .is('deleted_at', null)
    .single();

  if (docError || !doc) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
  }

  const { data: signedData, error: signError } = await db
    .storage
    .from('documents')
    .createSignedUrl(doc.file_path, 60, {
      download: doc.file_name,
    });

  if (signError || !signedData) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: 'Failed to generate download URL' } });
  }

  return res.json({ data: { url: signedData.signedUrl }, error: null });
});
