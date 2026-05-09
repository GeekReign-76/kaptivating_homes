'use client';

import { useEffect, useState } from 'react';
import Link      from 'next/link';
import { Users, MessageSquare, Calendar, Home, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  hot:    'bg-red-100 text-red-700',
  warm:   'bg-amber-100 text-amber-700',
  cold:   'bg-blue-100 text-blue-700',
  closed: 'bg-neutral-100 text-neutral-500',
};

export function DashboardOverview() {
  const [leads, setLeads]           = useState<any[]>([]);
  const [threads, setThreads]       = useState<any[]>([]);
  const [appointments, setApts]     = useState<any[]>([]);
  const [listings, setListings]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api.leads.list(),
      api.threads.list({ unread_only: 'false' }),
      api.appointments.list(),
      api.listings.list({ status: 'Active', limit: 3 }),
    ]).then(([l, t, a, li]) => {
      setLeads(Array.isArray(l) ? l : []);
      setThreads(Array.isArray(t) ? t : (t as any)?.data ?? []);
      setApts(Array.isArray(a) ? a : []);
      setListings((li as any)?.data ?? li ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const unreadThreads    = threads.filter((t: any) => t.agent_unread_count > 0).length;
  const newLeads7d       = leads.filter((l: any) => {
    const d = new Date(l.created_at);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const upcomingApts     = appointments.filter((a: any) =>
    a.status !== 'cancelled' && a.status !== 'completed' &&
    new Date(a.confirmed_start ?? a.requested_start) >= new Date()
  ).length;
  const activeListings   = Array.isArray(listings) ? listings.length : 0;

  const stats = [
    { label: 'Active Listings',   value: activeListings,  icon: Home,           href: '/dashboard/listings', color: 'text-blue-600' },
    { label: 'New Leads (7d)',    value: newLeads7d,      icon: TrendingUp,     href: '/dashboard/leads',    color: 'text-green-600' },
    { label: 'Unread Messages',   value: unreadThreads,   icon: MessageSquare,  href: '/dashboard/messages', color: 'text-brand-600' },
    { label: 'Upcoming Apts',     value: upcomingApts,    icon: Calendar,       href: '/dashboard',          color: 'text-amber-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-neutral-900 mb-8">Good morning 👋</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-neutral-500">{label}</p>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-3xl font-bold text-neutral-900">{value}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Leads */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Leads</CardTitle>
              <Link href="/dashboard/leads" className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-neutral-400 p-5">No leads yet.</p>
            ) : (
              <div className="divide-y divide-neutral-50">
                {leads.slice(0, 5).map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{l.user?.full_name}</p>
                      <p className="text-xs text-neutral-400">{l.user?.email} · {l.source}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[l.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length === 0 ? (
              <p className="text-sm text-neutral-400 p-5">No upcoming appointments.</p>
            ) : (
              <div className="divide-y divide-neutral-50">
                {appointments
                  .filter(a => (a.status === 'confirmed' || a.status === 'pending') && new Date(a.confirmed_start ?? a.requested_start) >= new Date())
                  .slice(0, 4)
                  .map((a: any) => {
                    const start = new Date(a.confirmed_start ?? a.requested_start);
                    return (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{a.client?.full_name}</p>
                          <p className="text-xs text-neutral-400">
                            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                            {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge variant={a.status === 'confirmed' ? 'success' : 'warning'} className="text-xs capitalize">
                          {a.status}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
