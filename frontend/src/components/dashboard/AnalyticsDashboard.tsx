'use client';

import { useEffect, useState } from 'react';
import { Users, Eye, MousePointer, Clock, TrendingUp, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const PERIOD_OPTIONS = [
  { label: '7 days',  value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export function AnalyticsDashboard() {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [days,    setDays]    = useState(30);

  useEffect(() => {
    setLoading(true);
    setError('');
    (api as any).analytics.summary({ days })
      .then((d: any) => setData(d))
      .catch((e: any) => setError(e.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-serif font-bold text-neutral-900">Analytics</h1>
            <p className="text-sm text-neutral-500 mt-1">Site traffic from Google Analytics</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-20 mb-2" /><Skeleton className="h-4 w-28" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div></CardContent></Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="font-semibold text-neutral-700">Could not load analytics</p>
        <p className="text-sm text-neutral-400 mt-1">{error}</p>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div>
        <h1 className="text-2xl font-serif font-bold text-neutral-900 mb-2">Analytics</h1>
        <p className="text-sm text-neutral-500 mb-8">Site traffic from Google Analytics</p>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-neutral-600">
            <p>To connect Google Analytics, add two environment variables to the backend <code className="bg-neutral-100 px-1 rounded">.env</code> file on the server:</p>
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>
                <strong>GA4_PROPERTY_ID</strong> — the numeric property ID from GA4 Admin → Property Settings
                (looks like <code className="bg-neutral-100 px-1 rounded">123456789</code>, not the <code className="bg-neutral-100 px-1 rounded">G-XXX</code> measurement ID)
              </li>
              <li>
                <strong>GA4_SERVICE_ACCOUNT_JSON</strong> — the full JSON contents of a Google service account key
                <ul className="list-disc ml-5 mt-1 space-y-1 text-neutral-500">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Google Cloud Console</a></li>
                  <li>Create a project → Enable "Google Analytics Data API"</li>
                  <li>IAM → Service Accounts → Create → Download JSON key</li>
                  <li>In GA4: Admin → Property Access Management → Add the service account email with Viewer role</li>
                  <li>Paste the JSON file contents (single line) as the env var value</li>
                </ul>
              </li>
            </ol>
            <p className="text-xs text-neutral-400">After adding the vars, rebuild and restart the backend. Analytics data is cached for 1 hour.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totals, topPages, channels } = data;
  const maxPageViews = Math.max(...(topPages ?? []).map((p: any) => p.views), 1);
  const maxSessions  = Math.max(...(channels ?? []).map((c: any) => c.sessions), 1);

  const stats = [
    { label: 'Users',        value: fmtNum(totals.users),              sub: `last ${days} days`, icon: Users,          color: 'text-blue-600' },
    { label: 'Sessions',     value: fmtNum(totals.sessions),           sub: `last ${days} days`, icon: MousePointer,   color: 'text-green-600' },
    { label: 'Page Views',   value: fmtNum(totals.pageviews),          sub: `last ${days} days`, icon: Eye,            color: 'text-brand-600' },
    { label: 'Avg. Duration',value: fmtDuration(totals.avgSessionDuration), sub: fmtPct(totals.bounceRate) + ' bounce rate', icon: Clock, color: 'text-amber-600' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-neutral-900">Analytics</h1>
          <p className="text-sm text-neutral-500 mt-1">Site traffic from Google Analytics</p>
        </div>
        <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg self-start sm:self-auto">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === opt.value ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
                <div className={`w-7 h-7 rounded-lg bg-neutral-50 flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-400 mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left text-xs font-medium text-neutral-400 px-4 py-2">Page</th>
                  <th className="text-right text-xs font-medium text-neutral-400 px-4 py-2">Views</th>
                  <th className="text-right text-xs font-medium text-neutral-400 px-4 py-2">Users</th>
                </tr>
              </thead>
              <tbody>
                {(topPages ?? []).map((page: any) => (
                  <tr key={page.path} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-neutral-700 truncate max-w-[180px]" title={page.path}>
                          {page.path === '/' ? 'Home' : page.path}
                        </span>
                        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden w-full">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${Math.round((page.views / maxPageViews) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-neutral-900">{fmtNum(page.views)}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-500">{fmtNum(page.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Traffic sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <MousePointer className="w-4 h-4" /> Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {(channels ?? []).map((ch: any) => {
              const pct = Math.round((ch.sessions / maxSessions) * 100);
              return (
                <div key={ch.channel}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-neutral-700">{ch.channel}</span>
                    <span className="text-neutral-500">{fmtNum(ch.sessions)} sessions</span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-neutral-100">
              <a
                href={`https://analytics.google.com/analytics/web/#/p${process.env.NEXT_PUBLIC_GA_PROPERTY_ID ?? ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-brand-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open full GA4 report
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
