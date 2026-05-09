'use client';

import { useState }                   from 'react';
import { useSearchParams }             from 'next/navigation';
import Link                            from 'next/link';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2 } from 'lucide-react';

export function RegisterForm() {
  const sp   = useSearchParams();
  const next = sp.get('next') ?? '/portal';

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const [done,  setDone]  = useState(false);

  function f(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('Name, email, and password are required.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setBusy(true);
    const supabase = createClient();
    if (!supabase) { setError('Auth not configured.'); setBusy(false); return; }
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { role: 'client', full_name: form.name, phone: form.phone || null },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-semibold text-neutral-900 mb-2">Almost there!</h2>
        <p className="text-sm text-neutral-500">
          We sent a confirmation link to <strong>{form.email}</strong>.
          Click it to activate your account, then you'll be redirected automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Full Name *</Label>
            <Input value={form.name} onChange={f('name')} placeholder="Jane Smith" className="mt-1" required />
          </div>
          <div className="col-span-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={f('email')} placeholder="jane@example.com" className="mt-1" required />
          </div>
          <div className="col-span-2">
            <Label>Phone <span className="text-neutral-400 font-normal">(optional)</span></Label>
            <Input type="tel" value={form.phone} onChange={f('phone')} placeholder="(555) 000-0000" className="mt-1" />
          </div>
          <div>
            <Label>Password *</Label>
            <Input type="password" value={form.password} onChange={f('password')} placeholder="8+ characters" className="mt-1" required />
          </div>
          <div>
            <Label>Confirm *</Label>
            <Input type="password" value={form.confirm} onChange={f('confirm')} placeholder="Confirm" className="mt-1" required />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create Account'}
        </Button>

        <p className="text-xs text-neutral-400 text-center">
          By registering you agree to receive property updates and messages from your agent.
        </p>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-brand-500 hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  );
}
