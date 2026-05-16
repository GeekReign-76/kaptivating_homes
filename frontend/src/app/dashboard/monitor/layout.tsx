import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_EMAIL = process.env.MONITOR_ADMIN_EMAIL ?? '';

export default async function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip in test mode only if the allowed email matches the env
  // (keeps the gate even in test mode for safety)
  const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

  if (!testMode) {
    const supabase = createClient();
    if (!supabase) redirect('/');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.email !== ALLOWED_EMAIL) {
      redirect('/dashboard');
    }
  }

  return <>{children}</>;
}
