/**
 * threadService.ts
 *
 * Thread CRUD, inbox management, and thread-to-chat conversion.
 *
 * Key rule: threads are never deleted. All state changes (appointment
 * confirmed, listing sold, etc.) inject system messages into the thread.
 */

import { db } from '../lib/db';
import { createNotification } from '../jobs/notifications/notificationWorker';

// -------------------------------------------------------------------------
// createThread
// Creates a new thread or returns the existing one if a duplicate exists.
// -------------------------------------------------------------------------

export async function createThread(params: {
  clientId:            string;
  relatedListingId?:   string;
  relatedListingType?: 'mls' | 'manual';
  initialMessage?:     string;
  subject?:            string;
  initiatedBy:         'client' | 'agent';
}): Promise<{ thread: any; isNew: boolean }> {
  const {
    clientId,
    relatedListingId,
    relatedListingType,
    initialMessage,
    subject,
    initiatedBy,
  } = params;

  // ---- Deduplication check ----
  // If a thread already exists for this client (optionally for the same listing),
  // return the existing thread instead of creating a duplicate.
  let existingQuery = db
    .from('threads')
    .select('*')
    .eq('client_id', clientId);

  if (relatedListingId) {
    existingQuery = existingQuery.eq('related_listing_id', relatedListingId);
  }

  const { data: existing } = await existingQuery.limit(1).single();

  if (existing) {
    return { thread: existing, isNew: false };
  }

  // ---- Build subject line ----
  let threadSubject = subject;
  if (!threadSubject && relatedListingId) {
    threadSubject = await buildListingSubject(relatedListingId, relatedListingType);
  }
  if (!threadSubject) {
    const { data: client } = await db
      .from('users')
      .select('full_name')
      .eq('id', clientId)
      .single();
    threadSubject = `Message from ${client?.full_name ?? 'Client'}`;
  }

  // ---- Create thread ----
  const { data: thread, error } = await db
    .from('threads')
    .insert({
      client_id:            clientId,
      related_listing_id:   relatedListingId   ?? null,
      related_listing_type: relatedListingType ?? null,
      subject:              threadSubject,
      last_message_at:      new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !thread) throw new Error(`Failed to create thread: ${error?.message}`);

  // ---- Create lead record if it doesn't exist ----
  await ensureLeadRecord(clientId, 'contact_form', relatedListingId, relatedListingType);

  // ---- Send initial message if provided ----
  if (initialMessage?.trim()) {
    await insertMessage({
      threadId:    thread.id,
      senderId:    initiatedBy === 'client' ? clientId : null,
      senderRole:  initiatedBy === 'client' ? 'client' : 'agent',
      messageType: 'text',
      content:     initialMessage,
    });
  }

  return { thread, isNew: true };
}

// -------------------------------------------------------------------------
// getThreads — paginated inbox for agent or client
// -------------------------------------------------------------------------

export async function getThreads(params: {
  userId:      string;
  role:        'agent' | 'client';
  unreadOnly?: boolean;
  clientId?:   string;  // agent only — filter by specific client
  page?:       number;
  limit?:      number;
}): Promise<{ threads: any[]; total: number }> {
  const { userId, role, unreadOnly, clientId, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = db
    .from('threads')
    .select(`
      *,
      client:users!threads_client_id_fkey ( id, full_name, email, avatar_url ),
      last_message:messages (
        content, message_type, sender_role, sent_at
      )
    `, { count: 'exact' })
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .limit(1, { referencedTable: 'messages' });

  // Role-based scoping
  if (role === 'client') {
    query = query.eq('client_id', userId);
  } else if (clientId) {
    query = query.eq('client_id', clientId);
  }

  // Unread filter
  if (unreadOnly) {
    const unreadCol = role === 'agent' ? 'agent_unread_count' : 'client_unread_count';
    query = query.gt(unreadCol, 0);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { threads: data ?? [], total: count ?? 0 };
}

// -------------------------------------------------------------------------
// getThread — single thread with last 50 messages
// -------------------------------------------------------------------------

export async function getThread(threadId: string, userId: string, role: 'agent' | 'client') {
  // Validate participant
  const { data: thread, error } = await db
    .from('threads')
    .select(`
      *,
      client:users!threads_client_id_fkey ( id, full_name, email, phone, avatar_url )
    `)
    .eq('id', threadId)
    .single();

  if (error || !thread) {
    throw Object.assign(new Error('Thread not found'), { code: 'NOT_FOUND' });
  }

  if (role === 'client' && thread.client_id !== userId) {
    throw Object.assign(new Error('Not your thread'), { code: 'UNAUTHORIZED' });
  }

  // Fetch last 50 messages
  const { data: messages } = await db
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: false })
    .limit(50);

  const hasMoreMessages = (messages?.length ?? 0) === 50;

  return {
    thread,
    messages: (messages ?? []).reverse(), // chronological order
    has_more_messages: hasMoreMessages,
  };
}

// -------------------------------------------------------------------------
// markThreadAsRead — mark all unread messages in a thread as read
// -------------------------------------------------------------------------

export async function markThreadAsRead(
  threadId: string,
  userId:   string,
  role:     'agent' | 'client',
): Promise<{ marked_read: number }> {
  const now = new Date().toISOString();

  // Mark messages read where the sender was the other party
  const senderRole = role === 'agent' ? 'client' : 'agent';

  const { data: updated } = await db
    .from('messages')
    .update({ read_at: now })
    .eq('thread_id', threadId)
    .eq('sender_role', senderRole)
    .is('read_at', null)
    .select('id');

  const markedCount = updated?.length ?? 0;

  // Reset unread count on thread
  const unreadCol = role === 'agent' ? 'agent_unread_count' : 'client_unread_count';
  await db
    .from('threads')
    .update({ [unreadCol]: 0 })
    .eq('id', threadId);

  return { marked_read: markedCount };
}

// -------------------------------------------------------------------------
// injectSystemMessage
// Called by other services (appointments, MLS sync) to add automated
// event records to a thread. Agent ↔ client can always see the full
// timeline of events in context.
// -------------------------------------------------------------------------

export async function injectSystemMessage(
  threadId:  string,
  content:   string,
  metadata?: Record<string, any>,
): Promise<void> {
  await insertMessage({
    threadId,
    senderId:    null,
    senderRole:  'system',
    messageType: 'system',
    content,
    metadata,
  });
}

// -------------------------------------------------------------------------
// findThreadForClient
// Used by appointment service to inject system messages into the right thread
// -------------------------------------------------------------------------

export async function findThreadForClient(clientId: string): Promise<string | null> {
  const { data } = await db
    .from('threads')
    .select('id')
    .eq('client_id', clientId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  return data?.id ?? null;
}

// -------------------------------------------------------------------------
// Private helpers
// -------------------------------------------------------------------------

export async function insertMessage(params: {
  threadId:    string;
  senderId:    string | null;
  senderRole:  'agent' | 'client' | 'system';
  messageType: string;
  content?:    string | null;
  metadata?:   Record<string, any>;
}): Promise<any> {
  const { threadId, senderId, senderRole, messageType, content, metadata } = params;

  const { data: message, error } = await db
    .from('messages')
    .insert({
      thread_id:    threadId,
      sender_id:    senderId,
      sender_role:  senderRole,
      message_type: messageType,
      content:      content ?? null,
      metadata:     metadata ?? {},
    })
    .select()
    .single();

  if (error || !message) throw new Error(`Failed to insert message: ${error?.message}`);

  // Update thread's last_message_at and increment recipient's unread count
  if (senderRole !== 'system') {
    const unreadCol = senderRole === 'agent' ? 'client_unread_count' : 'agent_unread_count';
    await db.rpc('increment_thread_unread', {
      p_thread_id: threadId,
      p_unread_col: unreadCol,
    });
    await db
      .from('threads')
      .update({ last_message_at: message.sent_at })
      .eq('id', threadId);
  }

  return message;
}

async function buildListingSubject(
  listingId:   string,
  listingType?: string,
): Promise<string> {
  const table = listingType === 'manual' ? 'manual_listings' : 'listings';
  const { data } = await db
    .from(table)
    .select('address, city, state')
    .eq('id', listingId)
    .single();

  if (!data) return 'Property Inquiry';
  return `Re: ${data.address}, ${data.city}, ${data.state}`;
}

async function ensureLeadRecord(
  userId:            string,
  source:            string,
  listingId?:        string,
  listingType?:      string,
): Promise<void> {
  const { data: existing } = await db
    .from('leads')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (existing) return;

  await db.from('leads').insert({
    user_id:              userId,
    source,
    source_listing_id:   listingId   ?? null,
    source_listing_type: listingType ?? null,
  });
}
