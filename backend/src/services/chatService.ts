/**
 * chatService.ts
 *
 * Live chat session management.
 * Handles the full lifecycle: create → join → message → close/convert.
 */

import { db }          from '../lib/db';
import { getIO }       from '../server';
import { isAgentOnline } from '../socket/socketServer';
import {
  emitNewChatSession,
  emitChatMessage,
  emitAgentJoined,
  emitChatClosed,
} from '../socket/chatSocket';
import { createThread, insertMessage } from './threadService';
import { createNotification }          from '../jobs/notifications/notificationWorker';

const OFFLINE_AUTO_RESPONSE =
  "Hi there! I'm not available right now but I'll get back to you within a few hours. " +
  "Leave your name and email and I'll reach out soon!";

// -------------------------------------------------------------------------
// createChatSession — guest initiates a chat
// -------------------------------------------------------------------------

export async function createChatSession(params: {
  guestName?:    string;
  guestEmail?:   string;
  guestPhone?:   string;
  initialMessage: string;
  sourcePath?:   string; // which page on the site they were on
}): Promise<{ session: any; agentOnline: boolean }> {
  const { guestName, guestEmail, initialMessage, sourcePath } = params;

  // Create session record
  const { data: session, error } = await db
    .from('chat_sessions')
    .insert({
      guest_name:  guestName  ?? null,
      guest_email: guestEmail ?? null,
      status:      'waiting',
    })
    .select()
    .single();

  if (error || !session) throw new Error(`Failed to create chat session: ${error?.message}`);

  // Save initial message
  await db.from('chat_messages').insert({
    session_id:  session.id,
    sender_type: 'guest',
    content:     initialMessage,
  });

  // Capture lead when guest provides an email
  if (guestEmail) {
    try {
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('email', guestEmail.toLowerCase())
        .maybeSingle();

      let guestUserId = existingUser?.id;

      if (!guestUserId) {
        const { data: newUser, error: userErr } = await db
          .from('users')
          .insert({
            id:        crypto.randomUUID(),
            email:     guestEmail.toLowerCase(),
            full_name: guestName ?? null,
            role:      'client',
          })
          .select('id')
          .single();
        if (userErr) console.error('[chatService] User insert error:', userErr.message);
        guestUserId = newUser?.id ?? null;
      } else if (guestName) {
        await db.from('users').update({ full_name: guestName }).eq('id', guestUserId).is('full_name', null);
      }

      if (guestUserId) {
        // Link session to user
        await db.from('chat_sessions').update({ user_id: guestUserId }).eq('id', session.id);

        const { data: existingLead } = await db.from('leads').select('id').eq('user_id', guestUserId).maybeSingle();
        if (!existingLead) {
          const { error: leadErr } = await db.from('leads').insert({
            user_id:     guestUserId,
            source:      'chat',
            agent_notes: initialMessage ? `First message: ${initialMessage.slice(0, 200)}` : null,
          });
          if (leadErr) console.error('[chatService] Lead insert error:', leadErr.message);
        }
      }
    } catch (err) {
      console.error('[chatService] Lead capture error:', err);
      // Non-blocking — don't fail the chat session
    }
  }

  const io         = getIO();
  const agentOnline = await isAgentOnline(io);

  if (agentOnline) {
    // Notify the agent in real-time
    emitNewChatSession(io, {
      id:           session.id,
      guest_name:   guestName  ?? 'Visitor',
      guest_email:  guestEmail ?? null,
      initial_message: initialMessage,
      source_path:  sourcePath ?? null,
      started_at:   session.started_at,
    });

    // Also queue a push notification (agent may have the tab open but on a different page)
    const { data: agentUser } = await db
      .from('users')
      .select('id')
      .eq('role', 'agent')
      .single();

    if (agentUser) {
      await createNotification(
        agentUser.id,
        'new_chat',
        `New chat from ${guestName ?? 'a visitor'}`,
        initialMessage.slice(0, 100),
        { session_id: session.id },
      );
    }
  } else {
    // Agent offline — send auto-response immediately
    await db.from('chat_messages').insert({
      session_id:  session.id,
      sender_type: 'system',
      content:     OFFLINE_AUTO_RESPONSE,
    });
  }

  return { session, agentOnline };
}

// -------------------------------------------------------------------------
// agentJoinSession — agent accepts an incoming chat
// -------------------------------------------------------------------------

export async function agentJoinSession(sessionId: string): Promise<any> {
  const { data: session, error } = await db
    .from('chat_sessions')
    .update({
      status:         'active',
      agent_joined_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .in('status', ['waiting'])
    .select()
    .single();

  if (error || !session) {
    throw Object.assign(
      new Error('Chat session not found or already active/closed'),
      { code: 'NOT_FOUND' },
    );
  }

  // Fetch all messages so far for context
  const { data: messages } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('sent_at', { ascending: true });

  const io = getIO();
  emitAgentJoined(io, sessionId, session.agent_joined_at);

  return { session, messages: messages ?? [] };
}

// -------------------------------------------------------------------------
// sendChatMessage — either agent or guest sends a message in a session
// -------------------------------------------------------------------------

export async function sendChatMessage(params: {
  sessionId:  string;
  senderType: 'agent' | 'guest';
  content:    string;
}): Promise<any> {
  const { sessionId, senderType, content } = params;

  if (!content?.trim()) {
    throw Object.assign(new Error('Message cannot be empty'), { code: 'VALIDATION_ERROR' });
  }

  // Validate session is open
  const { data: session } = await db
    .from('chat_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .in('status', ['waiting', 'active'])
    .single();

  if (!session) {
    throw Object.assign(new Error('Chat session not found or closed'), { code: 'NOT_FOUND' });
  }

  const { data: message, error } = await db
    .from('chat_messages')
    .insert({
      session_id:  sessionId,
      sender_type: senderType,
      content:     content.trim(),
    })
    .select()
    .single();

  if (error || !message) throw new Error(`Failed to send chat message: ${error?.message}`);

  // Emit to session room via Socket.io
  const io = getIO();
  emitChatMessage(io, sessionId, message);

  // If guest sends a message and agent is offline — queue push
  if (senderType === 'guest') {
    const agentOnline = await isAgentOnline(io);
    if (!agentOnline) {
      const { data: agentUser } = await db
        .from('users')
        .select('id')
        .eq('role', 'agent')
        .single();

      if (agentUser) {
        const { data: chatSession } = await db
          .from('chat_sessions')
          .select('guest_name')
          .eq('id', sessionId)
          .single();

        await createNotification(
          agentUser.id,
          'new_chat',
          `New message from ${chatSession?.guest_name ?? 'visitor'}`,
          content.slice(0, 100),
          { session_id: sessionId },
        );
      }
    }
  }

  return message;
}

// -------------------------------------------------------------------------
// closeChatSession — agent closes without converting
// -------------------------------------------------------------------------

export async function closeChatSession(sessionId: string): Promise<void> {
  await db
    .from('chat_sessions')
    .update({ status: 'closed', ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  const io = getIO();
  emitChatClosed(io, sessionId, 'Session ended by agent');
}

// -------------------------------------------------------------------------
// convertToThread
//
// Converts a live chat session into a persistent messaging thread.
// Guest receives a magic link email to register and access the thread.
// All chat messages are imported as thread messages.
// -------------------------------------------------------------------------

export async function convertToThread(params: {
  sessionId: string;
  subject?:  string;
}): Promise<{ threadId: string }> {
  const { sessionId, subject } = params;

  // Load session
  const { data: session, error } = await db
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    throw Object.assign(new Error('Chat session not found'), { code: 'NOT_FOUND' });
  }

  if (!session.guest_email) {
    throw Object.assign(
      new Error("Guest email is required to convert to a thread. Ask the guest for their email first."),
      { code: 'VALIDATION_ERROR' },
    );
  }

  // Create or find user for the guest
  const clientId = await ensureUserForGuest(session.guest_email, session.guest_name);

  // Create thread
  const { thread } = await createThread({
    clientId,
    subject:     subject ?? `Follow-up from live chat — ${formatDate(session.started_at)}`,
    initiatedBy: 'agent',
  });

  // Import chat messages into the thread
  const { data: chatMessages } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('sent_at', { ascending: true });

  for (const msg of chatMessages ?? []) {
    if (msg.sender_type === 'system') continue; // skip auto-responses

    await insertMessage({
      threadId:    thread.id,
      senderId:    msg.sender_type === 'guest' ? clientId : null,
      senderRole:  msg.sender_type === 'agent' ? 'agent' : 'client',
      messageType: 'text',
      content:     msg.content,
    });
  }

  // Update session: mark as converted
  await db
    .from('chat_sessions')
    .update({
      status:              'converted',
      user_id:             clientId,
      converted_thread_id: thread.id,
      ended_at:            new Date().toISOString(),
    })
    .eq('id', sessionId);

  // Emit chat_closed to session room
  const io = getIO();
  emitChatClosed(io, sessionId, 'converted');

  // Send magic link email to guest to continue the conversation
  await sendConversionEmail(session.guest_email, session.guest_name ?? 'there', thread.id);

  return { threadId: thread.id };
}

// -------------------------------------------------------------------------
// getAgentStatus — used by chat widget status indicator
// -------------------------------------------------------------------------

export async function getAgentStatus(): Promise<{ status: 'online' | 'away' | 'offline' }> {
  // Check manual status override from agent_settings first
  const { data: setting } = await db
    .from('agent_settings')
    .select('value')
    .eq('key', 'chat_status')
    .single();

  // Manual override takes priority over schedule
  if (setting?.value === 'online') return { status: 'online' };
  if (setting?.value === 'away')   return { status: 'away' };

  // Schedule: online 7am–7pm Eastern time, offline otherwise
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour:     'numeric',
      hour12:   false,
    }).format(new Date()),
    10,
  );
  const withinHours = etHour >= 7 && etHour < 19;
  return { status: withinHours ? 'online' : 'offline' };
}

// -------------------------------------------------------------------------
// Private helpers
// -------------------------------------------------------------------------

async function ensureUserForGuest(email: string, name?: string | null): Promise<string> {
  // Check if user already exists
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) return existing.id;

  // Create a stub user record — they'll complete registration via magic link
  const { data: newUser, error } = await db
    .from('users')
    .insert({
      id:        crypto.randomUUID(),
      email:     email.toLowerCase(),
      full_name: name ?? null,
      role:      'client',
    })
    .select('id')
    .single();

  if (error || !newUser) throw new Error(`Failed to create user: ${error?.message}`);

  // Create lead record
  await db.from('leads').insert({
    user_id: newUser.id,
    source:  'chat',
  });

  return newUser.id;
}

async function sendConversionEmail(
  email:    string,
  name:     string,
  threadId: string,
): Promise<void> {
  // Supabase auth sends the magic link; we include the thread deep link as the redirect URL
  const redirectTo = `${process.env.FRONTEND_URL}/portal/messages?thread=${threadId}`;

  try {
    await db.auth.admin.generateLink({
      type:        'magiclink',
      email,
      options: { redirectTo },
    });
    // The actual email is sent by Supabase's built-in email system
    // We can customize the template in the Supabase dashboard
    console.log(`[chatService] Magic link sent to ${email} for thread ${threadId}`);
  } catch (err) {
    // Non-blocking — log but don't fail the conversion
    console.error('[chatService] Failed to send conversion magic link:', err);
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}
