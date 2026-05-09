/**
 * chatSocket.ts
 *
 * Socket.io event handlers for live chat sessions.
 *
 * Live chat uses separate rooms ('chat:{session_id}') from thread rooms.
 * Guests don't have JWT tokens — they're identified by session_id.
 * The agent joins after seeing the 'new_chat_session' event.
 *
 * Client → Server (agent):
 *   join_chat          — agent joins a waiting chat session
 *   chat_typing_start  — agent started typing in chat
 *   chat_typing_stop   — agent stopped typing
 *
 * Server → Client events emitted from chatService.ts:
 *   new_chat_session   — new guest chat arrived (agent room)
 *   chat_message       — new message in a chat session
 *   agent_joined       — agent joined the session (sent to guest)
 *   chat_closed        — session ended (sent to both)
 *   chat_typing        — someone is typing in chat
 *   chat_typing_stopped
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from '../lib/db';

export function registerChatSocketHandlers(
  socket: Socket,
  io:     SocketIOServer,
): void {
  const { userId, role } = socket.data;

  // Only the agent has join_chat capability
  if (role !== 'agent') return;

  // -------------------------------------------------------------------------
  // join_chat — agent joins a waiting or active chat session
  // -------------------------------------------------------------------------

  socket.on('join_chat', async ({ session_id }: { session_id: string }) => {
    if (!session_id) return;

    const { data: session } = await db
      .from('chat_sessions')
      .select('id, status')
      .eq('id', session_id)
      .in('status', ['waiting', 'active'])
      .single();

    if (!session) {
      socket.emit('error', { code: 'NOT_FOUND', message: 'Chat session not found or already closed' });
      return;
    }

    await socket.join(`chat:${session_id}`);
    console.log(`[chatSocket] Agent joined chat:${session_id}`);
  });

  // -------------------------------------------------------------------------
  // chat_typing_start / chat_typing_stop
  // -------------------------------------------------------------------------

  socket.on('chat_typing_start', ({ session_id }: { session_id: string }) => {
    if (!session_id) return;
    if (!socket.rooms.has(`chat:${session_id}`)) return;

    socket.to(`chat:${session_id}`).emit('chat_typing', {
      session_id,
      sender_type: 'agent',
    });
  });

  socket.on('chat_typing_stop', ({ session_id }: { session_id: string }) => {
    if (!session_id) return;
    if (!socket.rooms.has(`chat:${session_id}`)) return;

    socket.to(`chat:${session_id}`).emit('chat_typing_stopped', {
      session_id,
      sender_type: 'agent',
    });
  });
}

// -------------------------------------------------------------------------
// Emit helpers — called from chatService.ts
// -------------------------------------------------------------------------

export function emitNewChatSession(
  io:      SocketIOServer,
  session: Record<string, any>,
): void {
  io.to('agent').emit('new_chat_session', { session });
}

export function emitChatMessage(
  io:        SocketIOServer,
  sessionId: string,
  message:   Record<string, any>,
): void {
  io.to(`chat:${sessionId}`).emit('chat_message', {
    session_id: sessionId,
    message,
  });
}

export function emitAgentJoined(
  io:            SocketIOServer,
  sessionId:     string,
  agentJoinedAt: string,
): void {
  io.to(`chat:${sessionId}`).emit('agent_joined', {
    session_id:     sessionId,
    agent_joined_at: agentJoinedAt,
  });
}

export function emitChatClosed(
  io:        SocketIOServer,
  sessionId: string,
  reason?:   string,
): void {
  io.to(`chat:${sessionId}`).emit('chat_closed', {
    session_id: sessionId,
    reason:     reason ?? 'Session ended',
  });
}

export function emitGuestTyping(
  io:        SocketIOServer,
  sessionId: string,
  isTyping:  boolean,
): void {
  io.to(`chat:${sessionId}`).emit(isTyping ? 'chat_typing' : 'chat_typing_stopped', {
    session_id:  sessionId,
    sender_type: 'guest',
  });
}
