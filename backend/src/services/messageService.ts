/**
 * messageService.ts
 *
 * Message creation, read receipts, and property card resolution.
 *
 * Sending a message:
 *   1. Validate sender is a thread participant
 *   2. Resolve metadata (property card lookup, document URL validation)
 *   3. Insert message to DB (via threadService.insertMessage)
 *   4. Emit Socket.io event
 *   5. Queue push notification if recipient is offline
 */

import { db }                from '../lib/db';
import { getIO }             from '../server';
import { insertMessage }     from './threadService';
import { emitNewMessage, emitMessageRead } from '../socket/threadSocket';
import { createNotification }              from '../jobs/notifications/notificationWorker';
import { isUserOnline }      from '../socket/socketServer';

// -------------------------------------------------------------------------
// sendMessage — main entry point for POST /threads/:id/messages
// -------------------------------------------------------------------------

export async function sendMessage(params: {
  threadId:     string;
  senderId:     string;
  senderRole:   'agent' | 'client';
  messageType:  'text' | 'property_card' | 'pdf' | 'image';
  content?:     string;
  metadata?:    Record<string, any>;
}): Promise<any> {
  const { threadId, senderId, senderRole, messageType, content, metadata } = params;

  // ---- Validate thread + participant ----
  const { data: thread, error: threadError } = await db
    .from('threads')
    .select('id, client_id, agent_unread_count, client_unread_count')
    .eq('id', threadId)
    .single();

  if (threadError || !thread) {
    throw Object.assign(new Error('Thread not found'), { code: 'NOT_FOUND' });
  }

  if (senderRole === 'client' && thread.client_id !== senderId) {
    throw Object.assign(new Error('Not your thread'), { code: 'UNAUTHORIZED' });
  }

  // ---- Resolve metadata for special message types ----
  const resolvedMetadata = await resolveMetadata(messageType, metadata ?? {});

  // ---- Validate content ----
  if (messageType === 'text' && !content?.trim()) {
    throw Object.assign(new Error('Message content cannot be empty'), { code: 'VALIDATION_ERROR' });
  }

  // ---- Insert to DB ----
  const message = await insertMessage({
    threadId,
    senderId,
    senderRole,
    messageType,
    content:  content?.trim() ?? null,
    metadata: resolvedMetadata,
  });

  // ---- Real-time delivery via Socket.io ----
  const io = getIO();
  emitNewMessage(io, threadId, message);

  // ---- Push notification if recipient is offline ----
  await maybeNotify(thread, senderRole, message);

  return message;
}

// -------------------------------------------------------------------------
// markMessageRead — PATCH /messages/:id/read
// -------------------------------------------------------------------------

export async function markMessageRead(
  messageId: string,
  userId:    string,
  role:      'agent' | 'client',
): Promise<{ read_at: string }> {
  const readAt = new Date().toISOString();

  const { data: message, error } = await db
    .from('messages')
    .update({ read_at: readAt })
    .eq('id', messageId)
    .is('read_at', null) // only update if not already read
    .select('id, thread_id, sender_role')
    .single();

  if (error || !message) {
    // Already read or not found — not an error worth surfacing
    return { read_at: readAt };
  }

  // Decrement unread count on thread
  if (message.sender_role !== role) {
    const unreadCol = role === 'agent' ? 'agent_unread_count' : 'client_unread_count';
    await db.rpc('decrement_thread_unread', {
      p_thread_id: message.thread_id,
      p_unread_col: unreadCol,
    });
  }

  // Emit read receipt via Socket.io
  const io = getIO();
  emitMessageRead(io, message.thread_id, messageId, readAt);

  return { read_at: readAt };
}

// -------------------------------------------------------------------------
// getMessages — paginated message history for a thread
// -------------------------------------------------------------------------

export async function getMessages(params: {
  threadId:  string;
  userId:    string;
  role:      'agent' | 'client';
  limit?:    number;
  before?:   string; // ISO timestamp — load messages before this time
}): Promise<{ messages: any[]; has_more: boolean }> {
  const { threadId, userId, role, limit = 50, before } = params;

  // Validate participant
  if (role === 'client') {
    const { data: thread } = await db
      .from('threads')
      .select('client_id')
      .eq('id', threadId)
      .single();

    if (thread?.client_id !== userId) {
      throw Object.assign(new Error('Not your thread'), { code: 'UNAUTHORIZED' });
    }
  }

  let query = db
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: false })
    .limit(limit + 1); // fetch one extra to determine has_more

  if (before) {
    query = query.lt('sent_at', before);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const messages    = data ?? [];
  const hasMore     = messages.length > limit;
  const pageResults = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: pageResults.reverse(), // return chronological order
    has_more: hasMore,
  };
}

// -------------------------------------------------------------------------
// resolveMetadata — enrich message metadata before storage
// -------------------------------------------------------------------------

async function resolveMetadata(
  messageType: string,
  metadata:    Record<string, any>,
): Promise<Record<string, any>> {
  switch (messageType) {

    case 'property_card': {
      // Resolve listing data and snapshot it into the message.
      // Using a snapshot means the card always renders correctly
      // even if the listing later goes sold or is removed from the feed.
      const { listing_id, listing_type } = metadata;
      if (!listing_id) {
        throw Object.assign(new Error('listing_id required for property_card'), { code: 'VALIDATION_ERROR' });
      }

      const table = listing_type === 'manual' ? 'manual_listings' : 'listings';
      const { data: listing } = await db
        .from(table)
        .select('id, address, city, state, price, beds, baths, photos')
        .eq('id', listing_id)
        .single();

      if (!listing) {
        throw Object.assign(new Error('Listing not found'), { code: 'NOT_FOUND' });
      }

      const firstPhoto = Array.isArray(listing.photos) && listing.photos.length > 0
        ? listing.photos[0]?.url
        : null;

      return {
        listing_id:   listing.id,
        listing_type: listing_type ?? 'mls',
        address:      listing.address,
        city:         listing.city,
        state:        listing.state,
        price:        listing.price,
        beds:         listing.beds,
        baths:        listing.baths,
        photo_url:    firstPhoto,
        listing_url:  `/listings/${listing.id}`,
      };
    }

    case 'pdf': {
      // Validate document exists in library
      const { document_id } = metadata;
      if (!document_id) {
        throw Object.assign(new Error('document_id required for pdf'), { code: 'VALIDATION_ERROR' });
      }

      const { data: doc } = await db
        .from('documents')
        .select('id, name, file_name, file_size_bytes')
        .eq('id', document_id)
        .single();

      if (!doc) {
        throw Object.assign(new Error('Document not found'), { code: 'NOT_FOUND' });
      }

      // Note: signed file_url is NOT stored in metadata — it's generated fresh
      // at read time via GET /documents/:id/download to avoid expired URLs.
      return {
        document_id:     doc.id,
        file_name:       doc.file_name,
        name:            doc.name,
        file_size_bytes: doc.file_size_bytes,
      };
    }

    case 'image': {
      // Images uploaded directly — metadata contains file_url already set by upload endpoint
      if (!metadata.file_url) {
        throw Object.assign(new Error('file_url required for image'), { code: 'VALIDATION_ERROR' });
      }
      return {
        file_url:  metadata.file_url,
        file_name: metadata.file_name ?? 'image',
        width:     metadata.width     ?? null,
        height:    metadata.height    ?? null,
      };
    }

    default:
      return metadata;
  }
}

// -------------------------------------------------------------------------
// maybeNotify — push notification if recipient is not online
// -------------------------------------------------------------------------

async function maybeNotify(
  thread:     any,
  senderRole: 'agent' | 'client',
  message:    any,
): Promise<void> {
  const io = getIO();

  if (senderRole === 'agent') {
    // Notify the client
    const clientOnline = await isUserOnline(io, thread.client_id);
    if (!clientOnline) {
      const agentName = process.env.AGENT_NAME ?? 'Your agent';
      const preview   = buildMessagePreview(message);
      await createNotification(
        thread.client_id,
        'new_message',
        `New message from ${agentName}`,
        preview,
        { thread_id: thread.id, message_id: message.id },
      );
    }
  } else {
    // Notify the agent
    const { data: agentUser } = await db
      .from('users')
      .select('id')
      .eq('role', 'agent')
      .single();

    if (agentUser) {
      const agentOnline = await isUserOnline(io, agentUser.id);
      if (!agentOnline) {
        const { data: sender } = await db
          .from('users')
          .select('full_name')
          .eq('id', message.sender_id)
          .single();
        const senderName = sender?.full_name ?? 'A client';
        const preview    = buildMessagePreview(message);
        await createNotification(
          agentUser.id,
          'new_message',
          `New message from ${senderName}`,
          preview,
          { thread_id: thread.id, message_id: message.id },
        );
      }
    }
  }
}

function buildMessagePreview(message: any): string {
  switch (message.message_type) {
    case 'property_card': {
      const m = message.metadata ?? {};
      return `Shared a property: ${m.address ?? 'a listing'}`;
    }
    case 'pdf':
      return `Shared a document: ${message.metadata?.file_name ?? 'a file'}`;
    case 'image':
      return 'Sent a photo';
    case 'text':
    default:
      return (message.content ?? '').slice(0, 100);
  }
}
