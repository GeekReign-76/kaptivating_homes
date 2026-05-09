/**
 * chat.ts — Express route handlers for live chat sessions
 */

import { Router, Request, Response } from 'express';
import {
  createChatSession,
  agentJoinSession,
  sendChatMessage,
  closeChatSession,
  convertToThread,
  getAgentStatus,
} from '../services/chatService';
import { db } from '../lib/db';

export const chatRouter = Router();

// -------------------------------------------------------------------------
// GET /api/v1/chat/agent-status
// Public — used by the chat widget to show online/away/offline indicator
// Lightweight, cached at the CDN/Nginx level for 30 seconds
// -------------------------------------------------------------------------

chatRouter.get('/agent-status', async (_req, res) => {
  const result = await getAgentStatus();
  res.set('Cache-Control', 'public, max-age=30');
  return res.json({ data: result, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/chat/sessions — guest initiates chat
// Public (no auth required) — guest identified by name + email
// -------------------------------------------------------------------------

chatRouter.post('/sessions', async (req: Request, res: Response) => {
  const { guest_name, guest_email, initial_message, source_path } = req.body;

  if (!initial_message?.trim()) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'initial_message is required' },
    });
  }

  try {
    const result = await createChatSession({
      guestName:      guest_name,
      guestEmail:     guest_email,
      initialMessage: initial_message,
      sourcePath:     source_path,
    });

    return res.status(201).json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// GET /api/v1/chat/sessions — agent lists active sessions
// -------------------------------------------------------------------------

chatRouter.get('/sessions', requireAgent, async (req: Request, res: Response) => {
  const { status = 'waiting,active', page = '1', limit = '20' } = req.query;
  const statuses = (status as string).split(',');
  const pageNum  = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset   = (pageNum - 1) * limitNum;

  const { data, error, count } = await db
    .from('chat_sessions')
    .select('*, chat_messages(*)', { count: 'exact' })
    .in('status', statuses)
    .order('started_at', { ascending: false })
    .range(offset, offset + limitNum - 1)
    .limit(1, { referencedTable: 'chat_messages' });

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({
    data,
    error: null,
    meta: { page: pageNum, limit: limitNum, total: count ?? 0 },
  });
});

// -------------------------------------------------------------------------
// GET /api/v1/chat/sessions/:id — get session with all messages
// -------------------------------------------------------------------------

chatRouter.get('/sessions/:id', requireAgent, async (req: Request, res: Response) => {
  const { data: session, error } = await db
    .from('chat_sessions')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !session) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } });
  }

  const { data: messages } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', req.params.id)
    .order('sent_at', { ascending: true });

  return res.json({ data: { session, messages: messages ?? [] }, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/chat/sessions/:id/join — agent joins a session
// -------------------------------------------------------------------------

chatRouter.post('/sessions/:id/join', requireAgent, async (req: Request, res: Response) => {
  try {
    const result = await agentJoinSession(req.params.id);
    return res.json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// POST /api/v1/chat/sessions/:id/messages — send a message in a session
// Agent sends via this endpoint; guest sends via Socket.io chat_message event
// (REST for agent ensures delivery even if WebSocket drops)
// -------------------------------------------------------------------------

chatRouter.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  const { content } = req.body;
  const senderType  = req.user?.role === 'agent' ? 'agent' : 'guest';

  if (!content?.trim()) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'content is required' },
    });
  }

  try {
    const message = await sendChatMessage({
      sessionId:  req.params.id,
      senderType: senderType as 'agent' | 'guest',
      content,
    });
    return res.status(201).json({ data: message, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/chat/sessions/:id/close
// -------------------------------------------------------------------------

chatRouter.patch('/sessions/:id/close', requireAgent, async (req: Request, res: Response) => {
  try {
    await closeChatSession(req.params.id);
    return res.json({ data: { status: 'closed' }, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// POST /api/v1/chat/sessions/:id/convert — convert chat to thread
// -------------------------------------------------------------------------

chatRouter.post('/sessions/:id/convert', requireAgent, async (req: Request, res: Response) => {
  const { subject } = req.body;

  try {
    const result = await convertToThread({ sessionId: req.params.id, subject });
    return res.json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/chat/agent-status — agent sets chat availability
// -------------------------------------------------------------------------

chatRouter.patch('/agent-status', requireAgent, async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!['online', 'away'].includes(status)) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'status must be "online" or "away"' },
    });
  }

  await db
    .from('agent_settings')
    .upsert({ key: 'chat_status', value: status }, { onConflict: 'key' });

  return res.json({ data: { status }, error: null });
});

// -------------------------------------------------------------------------
// Auth helpers
// -------------------------------------------------------------------------

function requireAgent(req: Request, res: Response, next: Function): void {
  if (!req.user || req.user.role !== 'agent') {
    res.status(403).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Agent access required' } });
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
