'use client';

import Link            from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Calendar, Heart, LogOut, Home, LayoutDashboard } from 'lucide-react';
import { cn }          from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth }     from '@/hooks/useAuth';

const NAV = [
  { href: '/portal/messages',     icon: MessageSquare, label: 'Messages'     },
  { href: '/portal/appointments', icon: Calendar,      label: 'Appointments' },
  { href: '/portal/saved',        icon: Heart,         label: 'Saved Homes'  },
];

export function PortalNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push('/');
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-neutral-200 min-h-screen sticky top-0">
        <div className="p-5 border-b border-neutral-100">
          <Link href="/" className="font-serif font-bold text-neutral-900 text-lg">
            {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Kaptivating Homes'}
          </Link>
          <p className="text-xs text-neutral-400 mt-0.5">Client Portal</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-neutral-600 hover:bg-neutral-50',
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-100 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">
              {user?.name?.charAt(0) ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{user?.name ?? 'Client'}</p>
              <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
            </div>
          </div>
          {user?.role === 'agent' && (
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 w-full px-1 font-medium">
              <LayoutDashboard className="w-4 h-4" /> Agent Dashboard
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 w-full px-1"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-200 flex">
        <Link href="/" className={cn('flex-1 flex flex-col items-center py-2 text-xs gap-1', 'text-neutral-400 hover:text-neutral-600')}>
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center py-2 text-xs gap-1',
              pathname.startsWith(href) ? 'text-brand-600' : 'text-neutral-400 hover:text-neutral-600',
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
        {user?.role === 'agent' && (
          <Link href="/dashboard" className="flex-1 flex flex-col items-center py-2 text-xs gap-1 text-brand-600">
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
        )}
      </nav>
    </>
  );
}
