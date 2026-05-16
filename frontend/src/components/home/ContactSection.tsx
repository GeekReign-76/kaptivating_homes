'use client';

import { useState } from 'react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { api }      from '@/lib/apiClient';
import { Phone, Mail, Clock, CheckCircle2 } from 'lucide-react';

export function ContactSection() {
  const [form, setForm]   = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError('Name, email, and message are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.threads.create({
        subject:         `Message from ${form.name}`,
        initial_message: `${form.message}\n\nPhone: ${form.phone || 'N/A'}`,
      });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again or call directly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="py-20 bg-neutral-900" id="contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">
          {/* Info */}
          <div>
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-wide mb-2">Get In Touch</p>
            <h2 className="font-serif text-3xl font-bold text-white mb-5">Ready to Find Your Home?</h2>
            <p className="text-neutral-400 leading-relaxed mb-8">
              Whether you have a question about a property, want to schedule a tour, or just
              want to talk through your options — reach out. I typically respond within a few hours.
            </p>

            <div className="space-y-5">
              {[
                { icon: Phone, label: process.env.NEXT_PUBLIC_AGENT_PHONE ?? '(336) 804-9760', href: `tel:${process.env.NEXT_PUBLIC_AGENT_PHONE ?? '(336) 804-9760'}` },
                { icon: Mail,  label: process.env.NEXT_PUBLIC_AGENT_EMAIL ?? 'Karsten.dmiller@gmail.com', href: `mailto:${process.env.NEXT_PUBLIC_AGENT_EMAIL ?? 'Karsten.dmiller@gmail.com'}` },
                { icon: Clock, label: 'Mon–Sat, 8am–7pm ET', href: undefined },
              ].map(({ icon: Icon, label, href }) => (
                <div key={label} className="flex items-center gap-3 text-neutral-300">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  {href ? (
                    <a href={href} className="hover:text-white transition-colors">{label}</a>
                  ) : (
                    <span>{label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl p-8">
            {sent ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="font-serif text-xl font-bold text-neutral-900 mb-2">Message Sent!</h3>
                <p className="text-neutral-500 text-sm">I'll get back to you within a few hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-serif text-xl font-bold text-neutral-900 mb-1">Send a Message</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className="mt-1" />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" className="mt-1" />
                </div>
                <div>
                  <Label>Message *</Label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="How can I help you?"
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Sending…' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
