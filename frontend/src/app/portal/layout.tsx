import { redirect }      from 'next/navigation';
import { createClient }  from '@/lib/supabase/server';
import { PortalNav }     from '@/components/portal/PortalNav';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

  if (!testMode) {
    const supabase = createClient();
    if (!supabase) {
      redirect('/auth/login?next=/portal');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect('/auth/login?next=/portal');
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <PortalNav />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
