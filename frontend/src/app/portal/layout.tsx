import { PortalNav } from '@/components/portal/PortalNav';

// Auth is enforced by middleware — no need to recheck here
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <PortalNav />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
