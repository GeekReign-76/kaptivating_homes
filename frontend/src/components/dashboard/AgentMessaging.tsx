'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter }   from 'next/navigation';
import { Send, FileText, Home } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';
import { cn, formatPrice, truncate } from '@/lib/utils';

export function AgentMessaging() {
  const sp       = useSearchParams();
  const router   = useRouter();
  const activeId = sp.get('thread');
  const [threads,  setThreads]  = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [active,   setActive]   = useState<any>(null);
  const [input,    setInput]    = useState('');
  const [loadingT, setLoadingT] = useState(true);
  const [loadingM, setLoadingM] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.threads.list().then((res: any) => {
      const list = Array.isArray(res) ? res : res.data ?? [];
      // Sort: unread first, then by last_message_at
      list.sort((a: any, b: any) => {
        if (b.agent_unread_count !== a.agent_unread_count) return b.agent_unread_count - a.agent_unread_count;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
      setThreads(list);
    }).finally(() => setLoadingT(false));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setLoadingM(true);
    api.threads.get(activeId).then((res: any) => {
      setActive(res.thread ?? res);
      setMessages(res.messages ?? []);
      api.threads.markRead(activeId).catch(() => {});
      setThreads(prev => prev.map(t => t.id === activeId ? { ...t, agent_unread_count: 0 } : t));
    }).finally(() => setLoadingM(false));
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage() {
    if (!input.trim() || !activeId) return;
    const content = input.trim();
    setInput('');
    const msg = await api.threads.sendMessage(activeId, { message_type: 'text', content });
    setMessages(prev => [...prev, msg]);
    setThreads(prev => prev.map(t => t.id === activeId ? { ...t, last_message: { content, sender_role: 'agent', sent_at: new Date().toISOString(), message_type: 'text' } } : t));
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white -m-2">
      {/* Thread list */}
      <div className="w-72 border-r border-neutral-200 flex flex-col">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingT ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))
          ) : (
            threads.map((t: any) => {
              const isActive = t.id === activeId;
              const unread   = t.agent_unread_count ?? 0;
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/dashboard/messages?thread=${t.id}`, { scroll: false })}
                  className={cn(
                    'w-full flex items-start gap-3 p-4 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50',
                    isActive && 'bg-brand-50',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                    {t.client?.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn('text-sm truncate', unread > 0 ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700')}>
                        {t.client?.full_name}
                      </p>
                      {unread > 0 && (
                        <span className="w-4 h-4 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center shrink-0">{unread}</span>
                      )}
                    </div>
                    {t.last_message && (
                      <p className="text-xs text-neutral-400 truncate">
                        {t.last_message.sender_role === 'agent' ? '✓ ' : ''}
                        {t.last_message.message_type === 'text' ? truncate(t.last_message.content ?? '', 40) : '📎 Attachment'}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 flex flex-col">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-neutral-300 flex-col gap-3">
            <Send className="w-12 h-12 opacity-30" />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-neutral-100">
              <p className="font-semibold text-neutral-900 text-sm">{active?.client?.full_name}</p>
              <p className="text-xs text-neutral-400">{active?.client?.email} · {active?.subject}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingM ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={cn('flex', i % 2 ? 'justify-end' : '')}>
                    <Skeleton className="h-10 w-48 rounded-2xl" />
                  </div>
                ))
              ) : (
                messages.map((m: any) => {
                  const isAgent = m.sender_role === 'agent';
                  if (m.sender_role === 'system') {
                    return <div key={m.id} className="text-center text-xs text-neutral-400 italic">{m.content}</div>;
                  }
                  if (m.message_type === 'property_card') {
                    const meta = m.metadata ?? {};
                    return (
                      <div key={m.id} className={cn('max-w-xs', isAgent ? 'ml-auto' : '')}>
                        <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm text-sm">
                          <div className="p-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
                            <Home className="w-3.5 h-3.5 text-neutral-400" />
                            <p className="font-medium truncate">{meta.address}</p>
                          </div>
                          <div className="p-3">
                            <p className="font-bold">{formatPrice(meta.price)}</p>
                            <p className="text-xs text-neutral-500">{meta.city}, {meta.state} · {meta.beds}bd/{meta.baths}ba</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (m.message_type === 'pdf') {
                    return (
                      <div key={m.id} className={cn('max-w-xs', isAgent ? 'ml-auto' : '')}>
                        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', isAgent ? 'bg-brand-500 text-white' : 'bg-neutral-100')}>
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate">{m.metadata?.file_name ?? 'Document'}</span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={cn('flex', isAgent ? 'justify-end' : '')}>
                      <div className={cn('max-w-[72%] px-4 py-2 rounded-2xl text-sm', isAgent ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-neutral-100 text-neutral-800 rounded-bl-sm')}>
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-neutral-100 flex gap-2">
              <Input
                placeholder="Reply…"
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
