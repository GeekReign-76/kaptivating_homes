'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api }      from '@/lib/apiClient';
import { cn, formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  pending:           { badge: 'bg-amber-100 text-amber-700',     label: 'Pending'          },
  suggested:         { badge: 'bg-amber-100 text-amber-700',     label: 'Suggested'        },
  confirmed:         { badge: 'bg-green-100 text-green-700',     label: 'Confirmed'        },
  counter_proposed:  { badge: 'bg-blue-100 text-blue-700',       label: 'Counter Proposed' },
  cancelled_client:  { badge: 'bg-neutral-100 text-neutral-500', label: 'Cancelled'        },
  cancelled_agent:   { badge: 'bg-neutral-100 text-neutral-500', label: 'Cancelled'        },
  completed:         { badge: 'bg-neutral-100 text-neutral-500', label: 'Completed'        },
  no_show:           { badge: 'bg-red-100 text-red-500',         label: 'No Show'          },
};

const TYPE_LABELS: Record<string, string> = {
  buyer_consultation: 'Buyer Consultation',
  property_showing:   'Property Showing',
  offer_review:       'Offer Review',
};

function formatApptTime(start: string | null, end: string | null) {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const date = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const startT = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endT   = e?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${startT}${endT ? ` – ${endT}` : ''}`;
}

export function AppointmentsManager() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);

  useEffect(() => {
    api.appointments.list().then((res: any) => {
      setAppointments(Array.isArray(res) ? res : res.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function confirm(id: string) {
    setActing(id);
    await api.appointments.confirm(id);
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed', confirmed_start: a.requested_start, confirmed_end: a.requested_end } : a));
    setActing(null);
  }

  async function cancel(id: string) {
    if (!window.confirm('Cancel this appointment?')) return;
    setActing(id);
    await api.appointments.cancel(id);
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled_agent' } : a));
    setActing(null);
  }

  const TERMINAL = ['cancelled_client', 'cancelled_agent', 'completed', 'no_show'];
  const upcoming  = appointments.filter(a => !TERMINAL.includes(a.status));
  const past      = appointments.filter(a => TERMINAL.includes(a.status));

  function ApptRow({ appt }: { appt: any }) {
    const style    = STATUS_STYLES[appt.status] ?? STATUS_STYLES.pending;
    const isOpen   = expanded === appt.id;
    const isActing = acting === appt.id;
    const displayTime = appt.confirmed_start ?? appt.requested_start;

    return (
      <div className="border-b border-neutral-100 last:border-0">
        <div
          className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 cursor-pointer"
          onClick={() => setExpanded(isOpen ? null : appt.id)}
        >
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
            {appt.client?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900">{appt.client?.full_name}</p>
            <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {formatApptTime(displayTime, appt.confirmed_end ?? appt.requested_end)}
            </p>
          </div>
          <span className="text-xs text-neutral-400 hidden sm:block shrink-0">
            {appt.appointment_types?.name ?? TYPE_LABELS[appt.appointment_type] ?? appt.appointment_type ?? 'Appointment'}
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', style.badge)}>
            {style.label}
          </span>
          {isOpen ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />}
        </div>

        {isOpen && (
          <div className="px-5 pb-5 pt-2 bg-neutral-50 border-t border-neutral-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-0.5">Client</p>
                  <p className="font-medium text-neutral-800">{appt.client?.full_name}</p>
                  <p className="text-neutral-500">{appt.client?.email}</p>
                  {appt.client?.phone && <p className="text-neutral-500">{appt.client.phone}</p>}
                </div>
                {(appt.client_note || appt.agent_note) && (
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-0.5">Notes</p>
                    {appt.client_note && <p className="text-neutral-600">{appt.client_note}</p>}
                    {appt.agent_note  && <p className="text-neutral-500 italic mt-0.5">Agent: {appt.agent_note}</p>}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {appt.status === 'counter_proposed' && (
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-0.5">Client Requested</p>
                    <p className="text-neutral-600">{formatApptTime(appt.requested_start, appt.requested_end)}</p>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-0.5 mt-2">Counter Proposed</p>
                    <p className="text-neutral-600">{formatApptTime(appt.confirmed_start, appt.confirmed_end)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-0.5">Created</p>
                  <p className="text-neutral-600">{formatDate(appt.created_at)}</p>
                </div>
              </div>
            </div>

            {['pending', 'counter_proposed'].includes(appt.status) && (
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => confirm(appt.id)}
                  disabled={isActing}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  {appt.status === 'counter_proposed' ? 'Accept Counter' : 'Confirm'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancel(appt.id)}
                  disabled={isActing}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Appointments</h1>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Calendar className="w-4 h-4" />
          {upcoming.length} upcoming
        </div>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past / Cancelled ({past.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <TabsContent value="upcoming">
              {upcoming.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-sm">No upcoming appointments.</div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  {upcoming.map(a => <ApptRow key={a.id} appt={a} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {past.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 text-sm">No past appointments.</div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  {past.map(a => <ApptRow key={a.id} appt={a} />)}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
