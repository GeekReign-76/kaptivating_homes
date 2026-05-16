import { DashboardNav } from '@/components/dashboard/DashboardNav';

// Auth + role enforcement is handled by middleware
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-100">
      <DashboardNav />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
