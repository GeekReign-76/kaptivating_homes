/**
 * threadSocket.ts
 *
 * Socket.io event handlers scoped to messaging threads.
 *
 * Client → Server events handled here:
 *   join_thread    — join a thread room (lazy, on conversation open)
 *   leave_thread   — leave a thread room (on conversation close/navigate away)
 *   typing_start   — user started typing
 *   typing_stop    — user stopped typing
 *
 * Server → Client events emitted from messageService.ts:
 *   new_message    — a new message arrived in a thread room
 *   message_read   — a message was marked as read
 *   typing         — someone is typing in a thread
 *   typing_stopped — someone stopped typing
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from '../lib/db';

export function registerThreadSocketHandlers(
  socket: Socket,
  io:     SocketIOServer,
): void {
  const { userId, role } = socket.data;

  // -------------------------------------------------------------------------
  // join_thread
  // Client requests to receive real-time events for a thread.
  // Server validates the client is a participant before allowing join.
  // -------------------------------------------------------------------------

  socket.on('join_thread', async ({ thread_id }: { thread_id: string }) => {
    if (!thread_id) return;

    // Prevent duplicate joins
    if (socket.rooms.has(`thread:${thread_id}`)) return;

    try {
      const isParticipant = await validateThreadParticipant(thread_id, userId, role);
      if (!isParticipant) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not a participant in this thread' });
        return;
      }

      await socket.join(`thread:${thread_id}`);
      console.log(`[threadSocket] ${role} ${userId} joined thread:${thread_id}`);
    } catch (err) {
      console.error('[threadSocket] join_thread error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // leave_thread
  // Called when user navigates away from a conversation.
  // -------------------------------------------------------------------------

  socket.on('leave_thread', ({ thread_id }: { thread_id: string }) => {
    if (!thread_id) return;
    socket.leave(`thread:${thread_id}`);
    console.log(`[threadSocket] ${role} ${userId} left thread:${thread_id}`);
  });

  // -------------------------------------------------------------------------
  // typing_start
  // Broadcast to the rest of the thread room (not back to sender).
  // No DB write — purely ephemeral real-time event.
  // -------------------------------------------------------------------------

  socket.on('typing_start', ({ thread_id }: { thread_id: string }) => {
    if (!thread_id) return;
    if (!socket.rooms.has(`thread:${thread_id}`)) return;

    socket.to(`thread:${thread_id}`).emit('typing', {
      thread_id,
      sender_role: role,
      user_id:     userId,
    });
  });

  // -------------------------------------------------------------------------
  // typing_stop
  // -------------------------------------------------------------------------

  socket.on('typing_stop', ({ thread_id }: { thread_id: string }) => {
    if (!thread_id) return;
    if (!socket.rooms.has(`thread:${thread_id}`)) return;

    socket.to(`thread:${thread_id}`).emit('typing_stopped', {
      thread_id,
      sender_role: role,
      user_id:     userId,
    });
  });
}

// -------------------------------------------------------------------------
// validateThreadParticipant
// Returns true if the user is the agent (agents see all threads)
// or if the user is the thread's client.
// -------------------------------------------------------------------------

async function validateThreadParticipant(
  threadId: string,
  userId:   string,
  role:     'agent' | 'client',
): Promise<boolean> {
  if (role === 'agent') return true;

  const { data: thread } = await db
    .from('threads')
    .select('client_id')
    .eq('id', threadId)
    .single();

  return thread?.client_id === userId;
}

// -------------------------------------------------------------------------
// emitNewMessage — called from messageService after INSERT
// Emits to the thread room. If no one is in the room, the emit is a noop.
// Push notification is handled separately (BullMQ, not Socket.io).
// -------------------------------------------------------------------------

export function emitNewMessage(
  io:        SocketIOServer,
  threadId:  string,
  message:   Record<string, any>,
): void {
  io.to(`thread:${threadId}`).emit('new_message', {
    thread_id: threadId,
    message,
  });
}

// -------------------------------------------------------------------------
// emitMessageRead — called from messageService after read receipt update
// -------------------------------------------------------------------------

export function emitMessageRead(
  io:        SocketIOServer,
  threadId:  string,
  messageId: string,
  readAt:    string,
): void {
  io.to(`thread:${threadId}`).emit('message_read', {
    thread_id:  threadId,
    message_id: messageId,
    read_at:    readAt,
  });
}
