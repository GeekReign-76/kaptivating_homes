'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minus } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { api }      from '@/lib/apiClient';
import { isTestMode } from '@/lib/testMode';
import { cn }       from '@/lib/utils';

type Stage = 'idle' | 'form' | 'active' | 'offline';

interface Msg { role: 'guest' | 'agent' | 'system'; content: string; }

export function ChatWidget() {
  const [open,    setOpen]    = useState(false);
  const [stage,   setStage]   = useState<Stage>('idle');
  const [status,  setStatus]  = useState<'online' | 'away' | 'offline'>('offline');
  const [unread,  setUnread]  = useState(0);
  const [msgs,    setMsgs]    = useState<Msg[]>([]);
  const [input,   setInput]   = useState('');
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [initMsg, setInitMsg] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending]    = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.chat.agentStatus().then((s: any) => setStatus(s.status ?? 'offline'));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  function openWidget() {
    setOpen(true);
    setUnread(0);
    if (stage === 'idle') setStage('form');
  }

  async function startChat() {
    if (!initMsg.trim()) return;
    setSending(true);
    try {
      const res: any = await api.chat.createSession({
        guest_name:      name || undefined,
        guest_email:     email || undefined,
        initial_message: initMsg,
      });
      setSessionId(res.session?.id ?? null);
      const newMsgs: Msg[] = [{ role: 'guest', content: initMsg }];

      if (res.agentOnline || isTestMode()) {
        setStage('active');
        setMsgs(newMsgs);
        // Simulate agent reply in test mode
        if (isTestMode()) {
          setTimeout(() => {
            setMsgs(prev => [...prev, {
              role: 'agent',
              content: `Hi${name ? ` ${name}` : ''}! Thanks for reaching out. I'll be with you shortly.`,
            }]);
          }, 1800);
        }
      } else {
        setStage('offline');
        setMsgs([
          ...newMsgs,
          { role: 'system', content: "I'm not available right now but I'll get back to you within a few hours. Leave your name and email and I'll reach out soon!" },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId) return;
    const content = input.trim();
    setInput('');
    setMsgs(prev => [...prev, { role: 'guest', content }]);
    await api.chat.sendMessage(sessionId, content);
  }

  const statusDot: Record<string, string> = {
    online:  'bg-green-500',
    away:    'bg-amber-400',
    offline: 'bg-neutral-400',
  };
  const statusLabel: Record<string, string> = {
    online:  'Online',
    away:    'Away',
    offline: 'Offline',
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={openWidget}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[360px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-brand-500 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {(process.env.NEXT_PUBLIC_AGENT_NAME ?? 'A').charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-tight">{process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Your Agent'}</p>
              <p className="flex items-center gap-1 text-white/80 text-xs">
                <span className={cn('w-2 h-2 rounded-full', statusDot[status])} />
                {statusLabel[status]}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {stage === 'form' && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-neutral-600">Hi! Send me a message and I'll get back to you as soon as possible.</p>
                <Input placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
                <textarea
                  placeholder="How can I help you? *"
                  value={initMsg}
                  onChange={e => setInitMsg(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startChat(); } }}
                />
                <Button className="w-full" onClick={startChat} disabled={!initMsg.trim() || sending}>
                  {sending ? 'Starting chat…' : 'Start Chat'}
                </Button>
              </div>
            )}

            {(stage === 'active' || stage === 'offline') && (
              <div className="p-4 space-y-3">
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={cn('max-w-[80%] text-sm rounded-2xl px-3 py-2', {
                      'ml-auto bg-brand-500 text-white rounded-br-sm': m.role === 'guest',
                      'bg-neutral-100 text-neutral-800 rounded-bl-sm':  m.role === 'agent',
                      'mx-auto text-center text-xs text-neutral-400 italic bg-transparent max-w-full': m.role === 'system',
                    })}
                  >
                    {m.content}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          {stage === 'active' && (
            <div className="p-3 border-t border-neutral-100 flex gap-2">
              <Input
                placeholder="Type a message…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                className="flex-1"
              />
              <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}

          {stage === 'offline' && (
            <div className="p-3 border-t border-neutral-100 text-center">
              <p className="text-xs text-neutral-400">We'll email you when we respond.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
