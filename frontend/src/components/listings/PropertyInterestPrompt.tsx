'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Heart, Send, Calendar, ChevronRight } from 'lucide-react';
import { api } from '@/lib/apiClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  onArm?: (fn: (context: string) => void) => void;
}

type Step = 'share' | 'book' | 'done';

export function PropertyInterestPrompt({ onArm }: Props) {
  const [show, setShow]         = useState(false);
  const [step, setStep]         = useState<Step>('share');
  const [saving, setSaving]     = useState(false);

  const [share, setShare] = useState({ name: '', email: '', phone: '', url: '', note: '' });
  const [book,  setBook]  = useState({
    appointment_type: 'property_showing',
    preferred_date:   '',
    preferred_time:   'flexible',
  });

  const contextRef  = useRef('');
  const hasLeftRef  = useRef(false);
  // Captured after share step — forwarded into booking
  const capturedRef = useRef({ name: '', email: '', phone: '' });

  // ── Expose arm() ──────────────────────────────────────────────────────────
  const arm = useCallback((context: string) => {
    contextRef.current = context;
    hasLeftRef.current = true;
  }, []);

  useEffect(() => { onArm?.(arm); }, [onArm, arm]);

  // ── Return-to-tab detection ───────────────────────────────────────────────
  useEffect(() => {
    function trigger() {
      if (!hasLeftRef.current) return;
      hasLeftRef.current = false;
      setTimeout(() => {
        setStep('share');
        setShare({ name: '', email: '', phone: '', url: '', note: '' });
        setBook({ appointment_type: 'property_showing', preferred_date: '', preferred_time: 'flexible' });
        setShow(true);
      }, 600);
    }

    const onVisibility = () => { if (document.visibilityState === 'visible') trigger(); };
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ── Step 1 — Share a property ─────────────────────────────────────────────
  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const contextParts = [
      contextRef.current            ? contextRef.current                  : null,
      share.url   ? `Property URL: ${share.url}`   : null,
      share.phone ? `Phone: ${share.phone}`         : null,
      share.note  ? `Note: ${share.note}`           : null,
    ].filter(Boolean).join(' | ');

    try {
      await api.leads.capture({
        email:   share.email,
        name:    share.name || undefined,
        source:  'property-interest',
        context: contextParts,
      });
    } catch { /* silent */ }

    capturedRef.current = { name: share.name, email: share.email, phone: share.phone };
    // If they shared a specific property URL, default to showing; otherwise consultation
    setBook(b => ({
      ...b,
      appointment_type: share.url ? 'property_showing' : 'buyer_consultation',
    }));
    setSaving(false);
    setStep('book');
  }

  // ── Step 2 — Book an appointment ──────────────────────────────────────────
  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/v1/appointments/public-book`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:             capturedRef.current.name,
          email:            capturedRef.current.email,
          phone:            capturedRef.current.phone,
          appointment_type: book.appointment_type,
          preferred_date:   book.preferred_date || undefined,
          preferred_time:   book.preferred_time,
          property_url:     share.url || undefined,
          search_context:   contextRef.current || undefined,
          note:             share.note || undefined,
        }),
      });
    } catch { /* silent */ }
    setSaving(false);
    setStep('done');
  }

  if (!show) return null;

  const contextLabel = contextRef.current
    .replace(/^Browsing listings: /, '')
    .replace(/^"(.*)".*$/, '$1');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-brand-600">
          <div className="flex items-center gap-2">
            {step === 'book'
              ? <Calendar className="w-5 h-5 text-white" />
              : <Heart className="w-5 h-5 text-white fill-white" />
            }
            <span className="font-semibold text-white">
              {step === 'share' && 'Share a property with Karsten'}
              {step === 'book'  && 'Book a showing or consultation'}
              {step === 'done'  && "You're all set!"}
            </span>
          </div>
          <button onClick={() => setShow(false)} className="text-white/70 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">

          {/* ── Step: Share ── */}
          {step === 'share' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {contextLabel
                  ? <>You were browsing <strong>{contextLabel}</strong>. Found something you like? Paste the listing link and Karsten will reach out.</>
                  : <>Found a property you like? Paste the listing link and Karsten will reach out with more details.</>
                }
              </p>
              <form onSubmit={handleShare} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text"  placeholder="Your name *"     value={share.name}  onChange={e => setShare(s => ({ ...s, name:  e.target.value }))} className="input-field" />
                  <input required type="email" placeholder="Email address *" value={share.email} onChange={e => setShare(s => ({ ...s, email: e.target.value }))} className="input-field" />
                </div>
                <input type="tel" placeholder="Phone (optional)" value={share.phone} onChange={e => setShare(s => ({ ...s, phone: e.target.value }))} className="input-field" />
                <input type="url" placeholder="Paste a listing URL from KW (optional)" value={share.url} onChange={e => setShare(s => ({ ...s, url: e.target.value }))} className="input-field" />
                <textarea rows={2} placeholder="Anything specific you're looking for? (optional)" value={share.note} onChange={e => setShare(s => ({ ...s, note: e.target.value }))} className="input-field resize-none" />
                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
                    <Send className="w-4 h-4" />
                    {saving ? 'Sending…' : 'Send to Karsten'}
                  </button>
                  <button type="button" onClick={() => setShow(false)} className="text-sm text-gray-500 hover:text-gray-700">Not now</button>
                </div>
              </form>
            </>
          )}

          {/* ── Step: Book ── */}
          {step === 'book' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Got it — Karsten will reach out. Want to go ahead and book a time now?
              </p>
              <form onSubmit={handleBook} className="space-y-3">
                {/* Appointment type */}
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'property_showing',       label: 'Property Showing',       desc: 'Tour a specific home' },
                    { value: 'buyer_consultation',     label: 'Buyer Consultation',     desc: 'General buying strategy' },
                    { value: 'relocation_consultation',label: 'Relocation Consultation',desc: 'Moving to Charlotte area' },
                  ].map(t => (
                    <label key={t.value} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${book.appointment_type === t.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="apt-type" value={t.value} checked={book.appointment_type === t.value} onChange={() => setBook(b => ({ ...b, appointment_type: t.value }))} className="accent-brand-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.label}</p>
                        <p className="text-xs text-gray-500">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Preferred date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Preferred date</label>
                    <input
                      type="date"
                      value={book.preferred_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setBook(b => ({ ...b, preferred_date: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Time preference</label>
                    <select value={book.preferred_time} onChange={e => setBook(b => ({ ...b, preferred_time: e.target.value }))} className="input-field">
                      <option value="flexible">Flexible</option>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
                    <Calendar className="w-4 h-4" />
                    {saving ? 'Requesting…' : 'Request Appointment'}
                  </button>
                  <button type="button" onClick={() => setShow(false)} className="text-sm text-gray-500 hover:text-gray-700">Maybe later</button>
                </div>
              </form>
            </>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-semibold text-gray-900 text-lg">Appointment requested!</p>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                Karsten will confirm your preferred time shortly. Check your email for details.
              </p>
              <button onClick={() => setShow(false)} className="mt-5 text-sm text-brand-600 hover:underline">
                Continue browsing
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
