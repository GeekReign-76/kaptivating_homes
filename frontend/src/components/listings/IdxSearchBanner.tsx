'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, MapPin, ArrowDown, Bell } from 'lucide-react';
import { api } from '@/lib/apiClient';

interface IdxSearchBannerProps {
  zip?: string;
}

export function IdxSearchBanner({ zip }: IdxSearchBannerProps) {
  const [stage, setStage] = useState<'popup' | 'notify' | 'hint' | 'gone'>('popup');
  const [copied, setCopied] = useState(false);
  const [email, setEmail]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // After copy: show the notify prompt
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setStage('notify'), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  // Focus email input when notify stage appears
  useEffect(() => {
    if (stage === 'notify') emailRef.current?.focus();
  }, [stage]);

  // After submitted or skipped, transition to hint
  useEffect(() => {
    if (stage !== 'hint') return;
    const timer = setTimeout(() => setStage('gone'), 4000);
    return () => clearTimeout(timer);
  }, [stage]);

  function handleCopy() {
    if (!zip) return;
    navigator.clipboard.writeText(zip).then(() => setCopied(true));
  }

  async function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await api.leads.capture({ email: email.trim(), source: 'zip_notify', context: `Zip code area: ${zip}` });
    } catch {
      // silently continue — don't block the user
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => setStage('hint'), 1200);
    }
  }

  if (!zip || stage === 'gone') return null;

  if (stage === 'hint') {
    return (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <div className="bg-neutral-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
          <ArrowDown className="w-4 h-4" />
          Paste <span className="font-bold tracking-wider">{zip}</span> into the Zip field
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">

        {/* Header */}
        <div className="bg-brand-500 px-6 py-5 text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-white text-lg font-serif font-bold">Find Homes in This Area</h2>
          <p className="text-white/80 text-sm mt-1">Copy the zip code and paste it into the search</p>
        </div>

        {/* Zip copy button */}
        <div className="p-6 space-y-4">
          <button
            onClick={handleCopy}
            className={`
              w-full rounded-xl border-2 py-5 px-6 flex items-center justify-between
              transition-all duration-200 active:scale-95
              ${copied
                ? 'border-green-400 bg-green-50'
                : 'border-brand-200 bg-brand-50 hover:border-brand-400 hover:bg-brand-100'}
            `}
          >
            <div className="text-left">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-1">Zip Code</p>
              <p className="text-4xl font-bold tracking-widest text-neutral-900">{zip}</p>
            </div>
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${copied ? 'bg-green-400' : 'bg-brand-500'}`}>
              {copied
                ? <Check className="w-6 h-6 text-white" strokeWidth={3} />
                : <Copy className="w-5 h-5 text-white" />
              }
            </div>
          </button>

          {/* Notify prompt — shown after copy */}
          {stage === 'notify' && (
            <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
              {submitted ? (
                <p className="text-center text-sm text-green-600 font-medium py-1">
                  <Check className="w-4 h-4 inline mr-1" strokeWidth={3} />
                  You're on the list!
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="w-4 h-4 text-brand-500 shrink-0" />
                    <p className="text-sm font-medium text-neutral-700">Get new listings in {zip} emailed to you</p>
                  </div>
                  <form onSubmit={handleNotify} className="flex gap-2">
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Your email"
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={!email.trim() || submitting}
                      className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {submitting ? '…' : 'Notify me'}
                    </button>
                  </form>
                  <button
                    onClick={() => setStage('hint')}
                    className="mt-2 w-full text-xs text-neutral-400 hover:text-neutral-600 text-center"
                  >
                    No thanks, I'll search now
                  </button>
                </>
              )}
            </div>
          )}

          {stage === 'popup' && (
            <p className="text-center text-xs text-neutral-400">
              {copied ? 'Copied! Pasting in a moment…' : 'Tap to copy, then paste into the Zip field below'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
