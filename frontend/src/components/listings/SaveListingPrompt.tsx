'use client';

import { useState, useEffect } from 'react';
import { Heart, X, Check } from 'lucide-react';
import { api } from '@/lib/apiClient';

interface SaveListingPromptProps {
  delayMs?: number;
}

export function SaveListingPrompt({ delayMs = 0 }: SaveListingPromptProps) {
  const [visible, setVisible]   = useState(delayMs === 0);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!visible) return null;
  const [saved, setSaved]       = useState(false);
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await api.leads.capture({
        email:   email.trim(),
        name:    name.trim() || undefined,
        source:  'save_listing',
        context: 'Saved a property from the listings page',
      });
      setSaved(true);
    } catch {
      // silently succeed from the user's perspective
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-neutral-900 text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap animate-fade-in">
          <Check className="w-4 h-4 text-green-400" strokeWidth={3} />
          Saved! Karsten will follow up with you.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating save button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 bg-white border border-neutral-200 text-neutral-700 hover:text-red-500 hover:border-red-200 hover:bg-red-50 px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-all"
        aria-label="Save a property"
      >
        <Heart className="w-4 h-4" />
        Save a property for Karsten
      </button>

      {/* Email gate modal */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-brand-500 px-6 py-5 flex items-start justify-between">
              <div>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-white text-lg font-serif font-bold leading-tight">
                  Share this with Karsten
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  Drop your email and he'll reach out to discuss it.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white mt-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email *"
                required
                autoFocus
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-neutral-400">
                Copy the property address or MLS# from the search below and mention it when Karsten replies.
              </p>
              <button
                type="submit"
                disabled={!email.trim() || submitting}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {submitting ? 'Saving…' : 'Notify Karsten'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
