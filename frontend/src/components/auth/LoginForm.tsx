'use client';

import { useState }               from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link                        from 'next/link';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const sp     = useSearchParams();
  const next   = sp.get('next') ?? '/portal';

  const [mode,   setMode]   = useState<'password' | 'magic'>('password');
  const [email,  setEmail]  = useState('');
  const [password, setPassword] = useState('');
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState('');
  const [sent,   setSent]   = useState(false);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const supabase = createClient();
    if (!supabase) { setError('Auth not configured.'); setBusy(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setBusy(false); return; }
    router.push(next);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const supabase = createClient();
    if (!supabase) { setError('Auth not configured.'); setBusy(false); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setBusy(false); return; }
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📬</span>
        </div>
        <h2 className="font-semibold text-neutral-900 mb-2">Check your email</h2>
        <p className="text-sm text-neutral-500">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 mb-6">
        {(['password', 'magic'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === m ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
          >
            {m === 'password' ? 'Password' : 'Magic Link'}
          </button>
        ))}
      </div>

      <form onSubmit={mode === 'password' ? handlePassword : handleMagicLink} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1" required />
        </div>

        {mode === 'password' && (
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" required />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : mode === 'password' ? 'Sign In' : 'Send Magic Link'}
        </Button>
      </form>

      <div className="mt-5 text-center text-sm text-neutral-500 space-y-2">
        <p>
          Don't have an account?{' '}
          <Link href={`/auth/register?next=${encodeURIComponent(next)}`} className="text-brand-500 hover:underline font-medium">Create one</Link>
        </p>
      </div>
    </div>
  );
}
