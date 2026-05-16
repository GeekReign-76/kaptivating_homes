'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, MessageSquare, Home, FileText, Calendar, Clock, LogOut, ExternalLink, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Overview',     adminOnly: false },
  { href: '/dashboard/leads',        icon: Users,           label: 'Leads',        adminOnly: false },
  { href: '/dashboard/messages',     icon: MessageSquare,   label: 'Messages',     adminOnly: false },
  { href: '/dashboard/appointments', icon: Calendar,        label: 'Appointments', adminOnly: false },
  { href: '/dashboard/schedule',     icon: Clock,           label: 'Schedule',     adminOnly: false },
  { href: '/dashboard/listings',     icon: Home,            label: 'Listings',     adminOnly: false },
  { href: '/dashboard/blog',         icon: FileText,        label: 'Blog',         adminOnly: false },
  { href: '/dashboard/monitor',      icon: Activity,        label: 'Monitor',      adminOnly: true  },
];

const MONITOR_EMAILS = (process.env.NEXT_PUBLIC_MONITOR_ADMIN_EMAIL ?? '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export function DashboardNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push('/');
  }

  function isActive(href: string) {
    return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
  }

  return (
    <aside className="w-60 bg-neutral-900 min-h-screen flex flex-col sticky top-0">
      <div className="p-5 border-b border-neutral-800">
        <p className="font-serif font-bold text-white text-base">
          {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Kaptivating Homes'}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">Agent Dashboard</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.filter(({ adminOnly }) => !adminOnly || MONITOR_EMAILS.includes(user?.email?.toLowerCase() ?? '')).map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-brand-500 text-white'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-800 space-y-3">
        <Link href="/" target="_blank" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          <ExternalLink className="w-4 h-4" /> View Site
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0) ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{user?.name ?? 'Agent'}</p>
            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}
