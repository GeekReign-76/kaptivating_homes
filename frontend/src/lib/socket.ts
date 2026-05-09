/**
 * socket.ts
 *
 * Socket.io client singleton.
 * Connect once, share across components via the useSocket() hook.
 *
 * The socket authenticates using the Supabase access token — backend
 * middleware (socketServer.ts) validates it and assigns the user room.
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
    auth:       { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay:    1500,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getExistingSocket(): Socket | null {
  return socket;
}
