/**
 * threads.ts — Express route handlers for threads and messages
 */

import { Router, Request, Response } from 'express';
import { createThread, getThreads, getThread, markThreadAsRead } from '../services/threadService';
import { sendMessage, markMessageRead, getMessages }              from '../services/messageService';

export const threadsRouter = Router();

// -------------------------------------------------------------------------
// GET /api/v1/threads
// -------------------------------------------------------------------------

threadsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { unread_only, client_id, page = '1', limit = '20' } = req.query;

  try {
    const result = await getThreads({
      userId:      req.user!.id,
      role:        req.user!.role as 'agent' | 'client',
      unreadOnly:  unread_only === 'true',
      clientId:    req.user!.role === 'agent' ? client_id as string | undefined : undefined,
      page:        parseInt(page as string, 10),
      limit:       Math.min(50, parseInt(limit as string, 10)),
    });

    return res.json({
      data: result.threads,
      error: null,
      meta: { page: parseInt(page as string), limit: parseInt(limit as string), total: result.total },
    });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// POST /api/v1/threads
// -------------------------------------------------------------------------

threadsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const { related_listing_id, related_listing_type, initial_message, client_id, subject } = req.body;

  // Clients create threads for themselves; agent specifies client_id
  const targetClientId = req.user!.role === 'agent'
    ? client_id
    : req.user!.id;

  if (!targetClientId) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'client_id is required when agent creates a thread' },
    });
  }

  try {
    const { thread, isNew } = await createThread({
      clientId:            targetClientId,
      relatedListingId:    related_listing_id,
      relatedListingType:  related_listing_type,
      initialMessage:      initial_message,
      subject,
      initiatedBy:         req.user!.role as 'agent' | 'client',
    });

    return res.status(isNew ? 201 : 200).json({ data: thread, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// GET /api/v1/threads/:id
// -------------------------------------------------------------------------

threadsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await getThread(req.params.id, req.user!.id, req.user!.role as 'agent' | 'client');
    return res.json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// GET /api/v1/threads/:id/messages
// -------------------------------------------------------------------------

threadsRouter.get('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const { limit = '50', before } = req.query;

  try {
    const result = await getMessages({
      threadId:  req.params.id,
      userId:    req.user!.id,
      role:      req.user!.role as 'agent' | 'client',
      limit:     Math.min(100, parseInt(limit as string, 10)),
      before:    before as string | undefined,
    });

    return res.json({ data: result.messages, error: null, meta: { has_more: result.has_more } });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// POST /api/v1/threads/:id/messages
// -------------------------------------------------------------------------

threadsRouter.post('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const { message_type = 'text', content, metadata } = req.body;

  const validTypes = ['text', 'property_card', 'pdf', 'image'];
  if (!validTypes.includes(message_type)) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: `message_type must be one of: ${validTypes.join(', ')}` },
    });
  }

  try {
    const message = await sendMessage({
      threadId:    req.params.id,
      senderId:    req.user!.id,
      senderRole:  req.user!.role as 'agent' | 'client',
      messageType: message_type,
      content,
      metadata,
    });

    return res.status(201).json({ data: message, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// POST /api/v1/threads/:id/read-all
// -------------------------------------------------------------------------

threadsRouter.post('/:id/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await markThreadAsRead(
      req.params.id,
      req.user!.id,
      req.user!.role as 'agent' | 'client',
    );
    return res.json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/messages/:id/read
// -------------------------------------------------------------------------

threadsRouter.patch('/messages/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await markMessageRead(
      req.params.id,
      req.user!.id,
      req.user!.role as 'agent' | 'client',
    );
    return res.json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// Auth middleware
// -------------------------------------------------------------------------

function requireAuth(req: Request, res: Response, next: Function): void {
  if (!req.user) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  next();
}

function handleError(res: Response, err: any): Response {
  const code = err.code ?? 'SERVER_ERROR';
  const statusMap: Record<string, number> = {
    NOT_FOUND:        404,
    UNAUTHORIZED:     403,
    VALIDATION_ERROR: 400,
    SERVER_ERROR:     500,
  };
  return res.status(statusMap[code] ?? 500).json({
    data: null,
    error: { code, message: err.message },
  });
}
