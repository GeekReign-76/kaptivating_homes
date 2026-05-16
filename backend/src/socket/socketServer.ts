/**
 * socketServer.ts
 *
 * Socket.io server setup:
 *   - JWT auth middleware (validates Supabase token on every connection)
 *   - Auto-join rooms on connect (agent room, user personal room)
 *   - Delegates event handling to threadSocket and chatSocket
 *   - Connection/disconnection logging
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from '../lib/db';
import { registerThreadSocketHandlers } from './threadSocket';
import { registerChatSocketHandlers }   from './chatSocket';

// Extend SocketData to carry authenticated user data
declare module 'socket.io' {
  interface SocketData {
    userId: string;
    role:   'agent' | 'client';
  }
}

// -------------------------------------------------------------------------
// registerSocketHandlers — called once from server.ts
// -------------------------------------------------------------------------

export function registerSocketHandlers(io: SocketIOServer): void {

  // ---- Auth middleware ----
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('UNAUTHORIZED: No token provided'));
    }

    // Validate the Supabase JWT
    const { data: { user }, error } = await db.auth.getUser(token);

    if (error || !user) {
      return next(new Error('UNAUTHORIZED: Invalid or expired token'));
    }

    // Look up role from our users table
    const { data: dbUser } = await db
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!dbUser) {
      return next(new Error('UNAUTHORIZED: User not found'));
    }

    socket.data.userId = dbUser.id;
    socket.data.role   = dbUser.role as 'agent' | 'client';
    next();
  });

  // ---- Connection handler ----
  io.on('connection', async (socket: Socket) => {
    const { userId, role } = socket.data;

    console.log(`[socket] Connected: ${role} ${userId} (${socket.id})`);

    // Auto-join personal rooms
    await socket.join(`user:${userId}`);
    if (role === 'agent') {
      await socket.join('agent');
      console.log(`[socket] Agent joined 'agent' room`);
    }

    // Register event handlers from sub-modules
    registerThreadSocketHandlers(socket, io);
    registerChatSocketHandlers(socket, io);

    // ---- Disconnection ----
    socket.on('disconnect', (reason) => {
      console.log(`[socket] Disconnected: ${role} ${userId} — ${reason}`);
    });

    // ---- Error ----
    socket.on('error', (err) => {
      console.error(`[socket] Error from ${userId}:`, err.message);
    });
  });
}

// -------------------------------------------------------------------------
// Helper: get all socket IDs for a user (across multiple tabs/devices)
// -------------------------------------------------------------------------

export async function getSocketsForUser(
  io:     SocketIOServer,
  userId: string,
): Promise<string[]> {
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.map((s) => s.id);
}

// -------------------------------------------------------------------------
// Helper: check if a user is currently connected
// -------------------------------------------------------------------------

export async function isUserOnline(
  io:     SocketIOServer,
  userId: string,
): Promise<boolean> {
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.length > 0;
}

// -------------------------------------------------------------------------
// Helper: check if the agent is online (used for live chat status widget)
// -------------------------------------------------------------------------

export async function isAgentOnline(io: SocketIOServer): Promise<boolean> {
  const sockets = await io.in('agent').fetchSockets();
  return sockets.length > 0;
}
