'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity, Database, Server, Cpu, RefreshCw,
  Bell, BellOff, CheckCircle2, AlertTriangle, XCircle, Wifi, WifiOff,
} from 'lucide-react';
import { requestPushPermission, unsubscribeFromPush } from '@/lib/pushSubscription';

const API_BASE    = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const POLL_MS     = 30_000;

interface HealthData {
  status:   'healthy' | 'degraded' | 'critical';
  uptime:   number;
  memory:   { heapUsed: number; heapTotal: number; rss: number; pct: number };
  database: { ok: boolean; latencyMs: number };
  redis:    { configured: boolean };
  process:  { pid: number; version: string; env: string };
  timestamp: string;
}

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key) ?? '{}')?.access_token ?? null;
  } catch { return null; }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

const STATUS_CONFIG = {
  healthy:  { label: 'Healthy',  color: 'text-green-400',  bg: 'bg-green-400/10',  icon: CheckCircle2  },
  degraded: { label: 'Degraded', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'text-red-400',    bg: 'bg-red-400/10',    icon: XCircle       },
};

export default function MonitorPage() {
  const [health,         setHealth]         = useState<HealthData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState('');
  const [lastFetched,    setLastFetched]    = useState<Date | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushBusy,       setPushBusy]       = useState(false);
  const [pushFeedback,   setPushFeedback]   = useState('');

  // ── fetch health ──────────────────────────────────────────────────────────
  const fetchHealth = useCallback(async () => {
    try {
      const token = getToken();
      const res   = await fetch(`${API_BASE}/api/v1/admin/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache:   'no-store',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setHealth(json.data);
      setFetchError('');
      setLastFetched(new Date());
    } catch (err: any) {
      setFetchError(err?.message ?? 'Unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const t = setInterval(fetchHealth, POLL_MS);
    return () => clearInterval(t);
  }, [fetchHealth]);

  // ── push permission state ─────────────────────────────────────────────────
  useEffect(() => {
    if (!('Notification' in window)) {
      setPushPermission('unsupported');
    } else {
      setPushPermission(Notification.permission);
    }
  }, []);

  async function enablePush() {
    setPushBusy(true);
    setPushFeedback('');
    const result = await requestPushPermission();
    if (result === 'granted') {
      setPushPermission('granted');
      setPushFeedback('Notifications enabled on this device.');
    } else if (result === 'denied') {
      setPushPermission('denied');
      setPushFeedback('Permission denied. Reset in browser settings.');
    } else {
      setPushFeedback('Push not supported on this browser/device.');
    }
    setPushBusy(false);
  }

  async function disablePush() {
    setPushBusy(true);
    await unsubscribeFromPush();
    setPushPermission('default');
    setPushFeedback('Notifications disabled on this device.');
    setPushBusy(false);
  }

  async function sendTestPush() {
    setPushBusy(true);
    setPushFeedback('');
    try {
      const token = getToken();
      const res   = await fetch(`${API_BASE}/api/v1/admin/push/test`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed');
      setPushFeedback('Test notification sent — check your device.');
    } catch (err: any) {
      setPushFeedback(err?.message ?? 'Failed to send test.');
    }
    setPushBusy(false);
  }

  // ── render ────────────────────────────────────────────────────────────────
  const statusCfg = health ? STATUS_CONFIG[health.status] : null;
  const StatusIcon = statusCfg?.icon ?? Activity;

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Server Monitor</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {lastFetched
              ? `Last checked ${lastFetched.toLocaleTimeString()} · refreshes every 30s`
              : 'Checking…'}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">Cannot reach backend</p>
            <p className="text-xs text-red-400/80">
              Error: {fetchError} — the API server may be down. Check GoDaddy panel and PM2.
            </p>
          </div>
        </div>
      )}

      {/* Status + core metrics */}
      {loading && !health ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-neutral-800 rounded-xl p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : health ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Status */}
            <div className={`rounded-xl p-4 ${statusCfg!.bg} border border-white/5`}>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon className={`w-4 h-4 ${statusCfg!.color}`} />
                <span className="text-xs text-neutral-400 uppercase tracking-wide">Status</span>
              </div>
              <p className={`text-2xl font-bold ${statusCfg!.color}`}>{statusCfg!.label}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {new Date(health.timestamp).toLocaleTimeString()}
              </p>
            </div>

            {/* Uptime */}
            <div className="bg-neutral-800 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-brand-400" />
                <span className="text-xs text-neutral-400 uppercase tracking-wide">Uptime</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatUptime(health.uptime)}</p>
              <p className="text-xs text-neutral-500 mt-0.5">PID {health.process.pid} · Node {health.process.version}</p>
            </div>

            {/* Memory */}
            <div className="bg-neutral-800 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-brand-400" />
                <span className="text-xs text-neutral-400 uppercase tracking-wide">Heap Memory</span>
              </div>
              <p className={`text-2xl font-bold ${
                health.memory.pct >= 90 ? 'text-red-400' :
                health.memory.pct >= 80 ? 'text-yellow-400' : 'text-white'
              }`}>
                {health.memory.pct}%
              </p>
              <div className="mt-2 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    health.memory.pct >= 90 ? 'bg-red-500' :
                    health.memory.pct >= 80 ? 'bg-yellow-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${health.memory.pct}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {health.memory.heapUsed}/{health.memory.heapTotal} MB · RSS {health.memory.rss} MB
              </p>
            </div>

            {/* Database */}
            <div className="bg-neutral-800 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-brand-400" />
                <span className="text-xs text-neutral-400 uppercase tracking-wide">Database</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${health.database.ok ? 'bg-green-400' : 'bg-red-400'}`} />
                <p className={`text-2xl font-bold ${health.database.ok ? 'text-white' : 'text-red-400'}`}>
                  {health.database.ok ? 'Online' : 'Down'}
                </p>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {health.database.ok
                  ? `${health.database.latencyMs}ms response`
                  : 'Cannot reach Supabase'}
              </p>
            </div>
          </div>

          {/* Process details */}
          <div className="bg-neutral-800 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-neutral-400" />
              <span className="text-sm font-semibold text-neutral-300">Process Details</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                ['Environment', health.process.env],
                ['Node.js',     health.process.version],
                ['PID',         String(health.process.pid)],
                ['Redis',       health.redis.configured ? 'Configured' : 'Not set'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-white font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Push Notifications */}
      <div className="bg-neutral-800 rounded-xl p-5 border border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-brand-400" />
          <h2 className="text-sm font-semibold text-neutral-300">Push Notifications — This Device</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-5">
          Enable push notifications on each device you want to receive server alerts on.
          Install this site as a PWA on your phone for background alerts.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {pushPermission === 'unsupported' ? (
            <span className="text-sm text-neutral-500">Push not supported on this browser.</span>
          ) : pushPermission === 'granted' ? (
            <>
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" /> Notifications enabled
              </div>
              <button
                onClick={sendTestPush}
                disabled={pushBusy}
                className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                Send Test Notification
              </button>
              <button
                onClick={disablePush}
                disabled={pushBusy}
                className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <BellOff className="w-4 h-4" /> Disable on this device
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <BellOff className="w-4 h-4" />
                {pushPermission === 'denied' ? 'Notifications blocked' : 'Notifications off'}
              </div>
              {pushPermission !== 'denied' && (
                <button
                  onClick={enablePush}
                  disabled={pushBusy}
                  className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Enable Notifications
                </button>
              )}
            </>
          )}
        </div>

        {pushFeedback && (
          <p className="mt-3 text-xs text-brand-300">{pushFeedback}</p>
        )}

        <div className="mt-5 pt-4 border-t border-neutral-700 text-xs text-neutral-500 space-y-1">
          <p>Automatic alerts are sent when:</p>
          <ul className="ml-3 space-y-0.5 list-disc list-inside">
            <li>Heap memory exceeds 80% (warning) or 90% (critical)</li>
            <li>Database becomes unreachable or responds in &gt;3 seconds</li>
          </ul>
          <p className="pt-1 text-neutral-600">
            For complete crash detection (process fully dead), point a free{' '}
            <span className="text-neutral-400">UptimeRobot</span> monitor at{' '}
            <span className="font-mono text-neutral-400">
              {process.env.NEXT_PUBLIC_API_URL ?? 'http://your-server:7381'}/health
            </span>
          </p>
        </div>
      </div>

    </div>
  );
}
