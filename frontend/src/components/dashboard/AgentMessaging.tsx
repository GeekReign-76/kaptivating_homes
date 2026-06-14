'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter }   from 'next/navigation';
import { Send, FileText, Home, MessageCircle, MessageSquare, Clock } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';
import { cn, formatPrice, truncate } from '@/lib/utils';

type Tab = 'threads' | 'chat';

export function AgentMessaging() {
  const sp       = useSearchParams();
  const router   = useRouter();
  const activeId = sp.get('thread');
  const [tab,      setTab]      = useState<Tab>('threads');
  const [threads,  setThreads]  = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [active,   setActive]   = useState<any>(null);
  const [input,    setInput]    = useState('');
  const [loadingT, setLoadingT] = useState(true);
  const [loadingM, setLoadingM] = useState(false);

  // Live chat state
  const [sessions,      setSessions]      = useState<any[]>([]);
  const [activeSess,    setActiveSess]    = useState<any>(null);
  const [sessionMsgs,   setSessionMsgs]  = useState<any[]>([]);
  const [sessInput,     setSessInput]     = useState('');
  const [loadingSess,   setLoadingSess]   = useState(false);
  const [loadingSessM,  setLoadingSessM] = useState(false);
  const [sessUnread,    setSessUnread]    = useState(0);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pollRef       = useRef<NodeJS.Timeout | null>(null);

  // ── Threads ──────────────────────────────────────────────────────────────

  useEffect(() => {
    api.threads.list().then((res: any) => {
      const list = Array.isArray(res) ? res : res.data ?? [];
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

  // ── Live Chat ─────────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const res: any = await api.chat.sessions({ status: 'waiting,active' });
      const list: any[] = Array.isArray(res) ? res : res.data ?? [];
      setSessions(list);
      // Count sessions with unread (waiting)
      setSessUnread(list.filter((s: any) => s.status === 'waiting').length);
    } catch { /* silent */ }
  }, []);

  // Poll sessions every 8s when on chat tab
  useEffect(() => {
    if (tab !== 'chat') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    setLoadingSess(true);
    loadSessions().finally(() => setLoadingSess(false));
    pollRef.current = setInterval(loadSessions, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, loadSessions]);

  async function openSession(sess: any) {
    setActiveSess(sess);
    setLoadingSessM(true);
    try {
      const res: any = await api.chat.getSession(sess.id);
      setSessionMsgs(res.messages ?? []);
      // Mark session active if still waiting
      if (sess.status === 'waiting') {
        await api.chat.join(sess.id).catch(() => {});
        setSessions(prev => prev.map(s => s.id === sess.id ? { ...s, status: 'active' } : s));
        setSessUnread(prev => Math.max(0, prev - 1));
      }
    } finally {
      setLoadingSessM(false);
    }
  }

  // Poll active session messages every 5s
  useEffect(() => {
    if (!activeSess) return;
    const interval = setInterval(async () => {
      try {
        const all: any[] = await api.chat.getMessages(activeSess.id);
        setSessionMsgs(all);
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeSess]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [sessionMsgs]);

  async function sendSessionReply() {
    if (!sessInput.trim() || !activeSess) return;
    const content = sessInput.trim();
    setSessInput('');
    await api.chat.sendMessage(activeSess.id, content);
    setSessionMsgs(prev => [...prev, { id: 'tmp-' + Date.now(), content, sender_type: 'agent', sent_at: new Date().toISOString() }]);
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white -m-2">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-200 shrink-0">
        <button
          onClick={() => setTab('threads')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'threads'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Messages
          {threads.some((t: any) => t.agent_unread_count > 0) && (
            <span className="w-4 h-4 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center">
              {threads.reduce((n: number, t: any) => n + (t.agent_unread_count ?? 0), 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('chat')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'chat'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
        >
          <MessageCircle className="w-4 h-4" />
          Live Chat
          {sessUnread > 0 && (
            <span className="w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {sessUnread}
            </span>
          )}
        </button>
      </div>

      {/* ── Threads panel ── */}
      {tab === 'threads' && (
        <div className="flex flex-1 overflow-hidden">
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
              ) : threads.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-12">No conversations yet.</p>
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
      )}

      {/* ── Live Chat panel ── */}
      {tab === 'chat' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Session list */}
          <div className="w-72 border-r border-neutral-200 flex flex-col">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">Live Chat</h2>
              <span className="text-xs text-neutral-400">auto-refreshes</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingSess ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-4">
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <MessageCircle className="w-8 h-8 text-neutral-200 mb-2" />
                  <p className="text-sm text-neutral-400">No active chats</p>
                  <p className="text-xs text-neutral-300 mt-1">New sessions appear here automatically</p>
                </div>
              ) : (
                sessions.map((s: any) => {
                  const isActive = activeSess?.id === s.id;
                  const isWaiting = s.status === 'waiting';
                  return (
                    <button
                      key={s.id}
                      onClick={() => openSession(s)}
                      className={cn(
                        'w-full flex items-start gap-3 p-4 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50',
                        isActive && 'bg-brand-50',
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold text-sm">
                          {(s.guest_name ?? s.guest_email ?? 'V').charAt(0).toUpperCase()}
                        </div>
                        {isWaiting && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn('text-sm truncate', isWaiting ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700')}>
                            {s.guest_name ?? s.guest_email ?? 'Visitor'}
                          </p>
                          <span className="text-xs text-neutral-400 shrink-0 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {relativeTime(s.started_at)}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-0.5">
                          <span className={cn('font-medium', isWaiting ? 'text-red-500' : 'text-green-600')}>
                            {isWaiting ? 'Waiting · ' : 'Active · '}
                          </span>
                          <span className="text-neutral-400">{s.guest_email ?? 'No email'}</span>
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 flex flex-col">
            {!activeSess ? (
              <div className="flex-1 flex items-center justify-center text-neutral-300 flex-col gap-3">
                <MessageCircle className="w-12 h-12 opacity-30" />
                <p className="text-sm">Select a chat session</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{activeSess.guest_name ?? 'Visitor'}</p>
                    <p className="text-xs text-neutral-400">{activeSess.guest_email ?? 'No email provided'} · started {relativeTime(activeSess.started_at)}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await api.chat.close(activeSess.id);
                      setActiveSess(null);
                      setSessionMsgs([]);
                      loadSessions();
                    }}
                    className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    Close session
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingSessM ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={cn('flex', i % 2 ? 'justify-end' : '')}>
                        <Skeleton className="h-10 w-48 rounded-2xl" />
                      </div>
                    ))
                  ) : (
                    sessionMsgs.map((m: any) => {
                      const isAgent = m.sender_type === 'agent';
                      const isSystem = m.sender_type === 'system';
                      if (isSystem) {
                        return <div key={m.id} className="text-center text-xs text-neutral-400 italic">{m.content}</div>;
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
                  <div ref={chatBottomRef} />
                </div>

                <div className="p-4 border-t border-neutral-100 flex gap-2">
                  <Input
                    placeholder="Reply to visitor…"
                    value={sessInput}
                    onChange={e => setSessInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSessionReply(); } }}
                    className="flex-1"
                  />
                  <Button onClick={sendSessionReply} disabled={!sessInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
