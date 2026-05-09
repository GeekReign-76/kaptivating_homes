'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter }   from 'next/navigation';
import Image     from 'next/image';
import { Send, MessageSquare, ExternalLink, FileText } from 'lucide-react';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Skeleton }  from '@/components/ui/skeleton';
import { Avatar }    from '@/components/ui/avatar';
import { api }       from '@/lib/apiClient';
import { cn, formatDate, formatPrice, truncate } from '@/lib/utils';
import { useAuth }   from '@/hooks/useAuth';

export function MessagingPortal() {
  const { user }    = useAuth();
  const sp          = useSearchParams();
  const router      = useRouter();
  const activeId    = sp.get('thread');
  const [threads,   setThreads]   = useState<any[]>([]);
  const [active,    setActive]    = useState<any>(null);
  const [messages,  setMessages]  = useState<any[]>([]);
  const [input,     setInput]     = useState('');
  const [loadingT,  setLoadingT]  = useState(true);
  const [loadingM,  setLoadingM]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load thread list
  useEffect(() => {
    api.threads.list().then((res: any) => {
      setThreads(Array.isArray(res) ? res : res.data ?? []);
    }).finally(() => setLoadingT(false));
  }, []);

  // Load active thread
  useEffect(() => {
    if (!activeId) return;
    setLoadingM(true);
    api.threads.get(activeId).then((res: any) => {
      setActive(res.thread ?? res);
      setMessages(res.messages ?? []);
      api.threads.markRead(activeId).catch(() => {});
    }).finally(() => setLoadingM(false));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || !activeId) return;
    const content = input.trim();
    setInput('');
    const msg = await api.threads.sendMessage(activeId, { message_type: 'text', content });
    setMessages(prev => [...prev, msg]);
    // Update thread list preview
    setThreads(prev => prev.map(t => t.id === activeId ? { ...t, last_message: { content, sent_at: new Date().toISOString(), sender_role: 'client', message_type: 'text' } } : t));
  }

  function selectThread(id: string) {
    router.push(`/portal/messages?thread=${id}`, { scroll: false });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {/* Thread list */}
      <div className={cn('w-full lg:w-80 border-r border-neutral-200 flex flex-col', activeId && 'hidden lg:flex')}>
        <div className="p-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingT ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-neutral-400">
              <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No conversations yet.</p>
            </div>
          ) : (
            threads.map((t: any) => {
              const isActive  = t.id === activeId;
              const unreadCol = user?.role === 'agent' ? 'agent_unread_count' : 'client_unread_count';
              const unread    = t[unreadCol] ?? 0;
              const clientName = t.client?.full_name ?? 'Client';
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={cn('w-full flex items-start gap-3 p-4 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50', isActive && 'bg-brand-50 border-brand-100')}
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                    {clientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm font-medium truncate', unread > 0 ? 'text-neutral-900 font-semibold' : 'text-neutral-700')}>
                        {clientName}
                      </p>
                      {unread > 0 && (
                        <span className="w-5 h-5 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{t.subject}</p>
                    {t.last_message && (
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {t.last_message.sender_role === 'agent' ? 'You: ' : ''}
                        {t.last_message.message_type === 'text' ? truncate(t.last_message.content ?? '', 50) : '📎 Attachment'}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation pane */}
      <div className={cn('flex-1 flex flex-col', !activeId && 'hidden lg:flex')}>
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400 flex-col gap-2">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Convo header */}
            <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3">
              <button onClick={() => router.push('/portal/messages')} className="lg:hidden text-neutral-400 hover:text-neutral-600 mr-1">←</button>
              <div>
                <p className="font-semibold text-neutral-900 text-sm">{active?.client?.full_name ?? 'Conversation'}</p>
                <p className="text-xs text-neutral-400">{active?.subject}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingM ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={cn('flex', i % 2 === 0 ? '' : 'justify-end')}>
                    <Skeleton className="h-12 w-48 rounded-2xl" />
                  </div>
                ))
              ) : (
                messages.map((m: any) => <MessageBubble key={m.id} message={m} userId={user?.id} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-neutral-100 flex gap-2">
              <Input
                placeholder="Type a message…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, userId }: { message: any; userId?: string }) {
  const isMe = message.sender_id === userId || (message.sender_role === 'client' && userId);
  // For client portal: client's own messages are on the right
  const selfSide = message.sender_role === 'client';

  if (message.sender_role === 'system') {
    return (
      <div className="text-center text-xs text-neutral-400 italic py-1">
        {message.content}
      </div>
    );
  }

  if (message.message_type === 'property_card') {
    const m = message.metadata ?? {};
    return (
      <div className={cn('max-w-xs', selfSide ? 'ml-auto' : '')}>
        <a href={m.listing_url ?? '#'} className="block bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          {m.photo_url && (
            <div className="relative aspect-video">
              <Image src={m.photo_url} alt={m.address ?? ''} fill className="object-cover" sizes="280px" />
            </div>
          )}
          <div className="p-3">
            <p className="font-bold text-neutral-900">{formatPrice(m.price)}</p>
            <p className="text-xs text-neutral-600 mt-0.5">{m.address}, {m.city}, {m.state}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{m.beds} bed · {m.baths} bath</p>
          </div>
        </a>
      </div>
    );
  }

  if (message.message_type === 'pdf') {
    const m = message.metadata ?? {};
    return (
      <div className={cn('max-w-xs', selfSide ? 'ml-auto' : '')}>
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', selfSide ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-800')}>
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">{m.file_name ?? 'Document'}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', selfSide ? 'justify-end' : '')}>
      <div className={cn('max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed',
        selfSide
          ? 'bg-brand-500 text-white rounded-br-sm'
          : 'bg-neutral-100 text-neutral-800 rounded-bl-sm',
      )}>
        {message.content}
      </div>
    </div>
  );
}
