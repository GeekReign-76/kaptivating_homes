import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

  if (!testMode) {
    const supabase = createClient();
    if (!supabase) {
      redirect('/');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.role !== 'agent') {
      redirect('/');
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <DashboardNav />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
