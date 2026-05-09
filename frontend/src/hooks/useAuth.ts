'use client';

import { useEffect, useState } from 'react';
import { createClient }        from '@/lib/supabase/client';
import { isTestMode }          from '@/lib/testMode';
import { MOCK_CLIENT_USER, MOCK_AGENT_USER } from '@/lib/mockData';

interface AuthUser {
  id:       string;
  email:    string;
  role:     'agent' | 'client';
  name:     string;
}

export function useAuth() {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isTestMode()) {
      // Use agent user so dashboard nav + role guards work in demo
      const m = MOCK_AGENT_USER;
      setUser({
        id:    m.id,
        email: m.email,
        role:  m.user_metadata.role as 'agent' | 'client',
        name:  m.user_metadata.full_name,
      });
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // No Supabase config — running without backend, treat as logged out
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          id:    user.id,
          email: user.email ?? '',
          role:  (user.user_metadata?.role as 'agent' | 'client') ?? 'client',
          name:  user.user_metadata?.full_name ?? user.email ?? '',
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id:    session.user.id,
          email: session.user.email ?? '',
          role:  (session.user.user_metadata?.role as 'agent' | 'client') ?? 'client',
          name:  session.user.user_metadata?.full_name ?? '',
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, isAgent: user?.role === 'agent' };
}
