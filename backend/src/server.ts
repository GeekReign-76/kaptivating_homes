/**
 * server.ts
 *
 * Express + Socket.io server entry point.
 * Exports getIO() so other modules can emit events without circular imports.
 *
 * Start: ts-node src/server.ts  (or via nodemon in dev)
 */

import express         from 'express';
import { createServer } from 'http';
import cors            from 'cors';
import helmet          from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { initWebPush }     from './jobs/notifications/pushSender';
import { setupSyncScheduler, shutdownSyncWorkers } from './jobs/sync/scheduler';
import { setupAppointmentReminderScheduler }        from './jobs/notifications/appointmentReminders';
import morgan                      from 'morgan';
import { registerSocketHandlers }  from './socket/socketServer';
import { appointmentsRouter }      from './routes/appointments';
import { threadsRouter }           from './routes/threads';
import { chatRouter }              from './routes/chat';
import { listingsRouter }          from './routes/listings';
import { searchRouter }            from './routes/search';
import { documentsRouter }         from './routes/documents';
import { leadsRouter }             from './routes/leads';
import { blogRouter }              from './routes/blog';
import { notificationsRouter }     from './routes/notifications';

// -------------------------------------------------------------------------
// Express app
// -------------------------------------------------------------------------

const app    = express();
const server = createServer(app);

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// -------------------------------------------------------------------------
// Routes
// -------------------------------------------------------------------------

app.use('/api/v1/listings',        listingsRouter);
app.use('/api/v1/saved-searches',  searchRouter);
app.use('/api/v1/documents',       documentsRouter);
app.use('/api/v1/leads',           leadsRouter);
app.use('/api/v1/blog',            blogRouter);
app.use('/api/v1/appointments',    appointmentsRouter);
app.use('/api/v1/threads',         threadsRouter);
app.use('/api/v1/chat',            chatRouter);
app.use('/api/v1',                 notificationsRouter); // /push/subscribe + /notifications

// Health check (used by Railway/Render deploy checks)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// -------------------------------------------------------------------------
// Socket.io
// -------------------------------------------------------------------------

export const io = new SocketIOServer(server, {
  cors: {
    origin:      process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  // Prefer WebSocket, fall back to polling
  transports: ['websocket', 'polling'],
});

// Expose io for use in other modules without circular imports
export function getIO(): SocketIOServer {
  return io;
}

registerSocketHandlers(io);

// -------------------------------------------------------------------------
// Startup
// -------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '4000', 10);

server.listen(PORT, async () => {
  console.log(`[server] API listening on port ${PORT}`);

  // Initialize VAPID keys for web push
  initWebPush();

  // Start recurring BullMQ schedulers
  await setupSyncScheduler();
  await setupAppointmentReminderScheduler();

  console.log('[server] All workers and schedulers started.');
});

// -------------------------------------------------------------------------
// Graceful shutdown
// -------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    await shutdownSyncWorkers();
    console.log('[server] Shutdown complete.');
    process.exit(0);
  });
  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 15_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
