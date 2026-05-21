'use client';

import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, CheckCircle2, AlertCircle, XCircle, ArrowRightLeft } from 'lucide-react';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api }     from '@/lib/apiClient';
import { cn, formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { icon: any; variant: any; label: string }> = {
  pending:          { icon: Clock,           variant: 'warning',     label: 'Pending Confirmation' },
  confirmed:        { icon: CheckCircle2,    variant: 'success',     label: 'Confirmed' },
  counter_proposed: { icon: ArrowRightLeft,  variant: 'warning',     label: 'New Time Proposed' },
  cancelled:        { icon: XCircle,         variant: 'destructive', label: 'Cancelled' },
  completed:        { icon: CheckCircle2,    variant: 'secondary',   label: 'Completed' },
};

const TYPE_LABELS: Record<string, string> = {
  buyer_consultation: 'Buyer Consultation',
  property_showing:   'Property Showing',
  offer_review:       'Offer Review',
};

export function AppointmentsPortal() {
  const [apts,     setApts]     = useState<any[]>([]);
  const [types,    setTypes]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.appointments.list(), api.appointments.types()])
      .then(([a, t]) => {
        setApts(Array.isArray(a) ? a : []);
        setTypes(Array.isArray(t) ? t : []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function acceptCounter(id: string) {
    setBusy(id);
    try {
      await api.appointments.acceptCounter(id);
      setApts(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed', confirmed_start: a.confirmed_start, confirmed_end: a.confirmed_end } : a));
    } finally { setBusy(null); }
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this appointment?')) return;
    setBusy(id);
    try {
      await api.appointments.cancel(id);
      setApts(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
    } finally { setBusy(null); }
  }

  const now      = new Date();
  const upcoming = apts.filter(a => a.status !== 'cancelled' && a.status !== 'completed' && new Date(a.confirmed_start ?? a.requested_start) >= now);
  const past     = apts.filter(a => a.status === 'completed' || a.status === 'cancelled' || new Date(a.confirmed_start ?? a.requested_start) < now);

  function AptCard({ apt }: { apt: any }) {
    const cfg   = STATUS_CONFIG[apt.status] ?? { icon: Clock, variant: 'secondary', label: apt.status };
    const Icon  = cfg.icon;
    const start = new Date(apt.confirmed_start ?? apt.requested_start);
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-neutral-900">{TYPE_LABELS[apt.appointment_type] ?? apt.appointment_type}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{apt.notes}</p>
          </div>
          <Badge variant={cfg.variant} className="shrink-0 flex items-center gap-1">
            <Icon className="w-3 h-3" /> {cfg.label}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-neutral-400" />
            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-neutral-400" />
            {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {apt.status === 'counter_proposed' && apt.confirmed_start && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-medium text-amber-800 flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4" /> Agent proposed a new time
            </p>
            <p className="text-amber-700">
              {new Date(apt.confirmed_start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
              {new Date(apt.confirmed_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <Button size="sm" onClick={() => acceptCounter(apt.id)} disabled={busy === apt.id}>
              {busy === apt.id ? 'Accepting…' : 'Accept New Time'}
            </Button>
          </div>
        )}

        {(apt.status === 'pending' || apt.status === 'confirmed') && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => cancel(apt.id)} disabled={busy === apt.id}>
              {busy === apt.id ? 'Cancelling…' : 'Cancel'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-serif font-bold text-neutral-900 mb-6">My Appointments</h1>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">Upcoming {upcoming.length > 0 && `(${upcoming.length})`}</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="book">Book New</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcoming.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No upcoming appointments.</p>
              </div>
            ) : upcoming.map(a => <AptCard key={a.id} apt={a} />)}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {past.length === 0 ? (
              <p className="text-center py-12 text-neutral-400 text-sm">No past appointments.</p>
            ) : past.map(a => <AptCard key={a.id} apt={a} />)}
          </TabsContent>

          <TabsContent value="book">
            <BookingForm types={types} onBooked={apt => { setApts(prev => [apt, ...prev]); }} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function BookingForm({ types, onBooked }: { types: any[]; onBooked: (a: any) => void }) {
  const [step,     setStep]     = useState<'type' | 'slot' | 'confirm' | 'done'>('type');
  const [typeId,   setTypeId]   = useState('');
  const [slots,    setSlots]    = useState<any[]>([]);
  const [slotIdx,  setSlotIdx]  = useState<number | null>(null);
  const [notes,    setNotes]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function loadSlots(tId: string) {
    setLoading(true);
    const now   = new Date();
    const start = now.toISOString().split('T')[0];
    const end   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res: any = await api.appointments.slots({ appointment_type_id: tId, start_date: start, end_date: end });
    setSlots(Array.isArray(res) ? res : []);
    setLoading(false);
    setStep('slot');
  }

  async function book() {
    if (slotIdx === null) return;
    setLoading(true);
    const slot = slots[slotIdx];
    const apt  = await api.appointments.book({
      appointment_type_id: typeId,
      requested_start:     slot.start,
      requested_end:       slot.end,
      booking_type:        'slot',
      client_note:         notes || undefined,
    });
    onBooked(apt);
    setStep('done');
    setLoading(false);
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-neutral-900">Appointment requested!</p>
        <p className="text-sm text-neutral-500 mt-1">You'll get a confirmation once the agent approves.</p>
        <Button variant="outline" className="mt-4" onClick={() => setStep('type')}>Book Another</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === 'type' && (
        <>
          <p className="text-sm text-neutral-600 font-medium">What type of appointment?</p>
          <div className="space-y-3">
            {types.map((t: any) => (
              <button
                key={t.id}
                onClick={() => { setTypeId(t.id); loadSlots(t.id); }}
                className="w-full text-left p-4 border border-neutral-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors"
              >
                <p className="font-medium text-neutral-900">{t.name}</p>
                {t.description && <p className="text-sm text-neutral-500 mt-0.5">{t.description}</p>}
                <p className="text-xs text-neutral-400 mt-1">{t.duration_minutes} minutes</p>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'slot' && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setStep('type')}>← Back</Button>
          <p className="text-sm font-medium text-neutral-700">Choose a time</p>
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((s: any, i: number) => {
                const d = new Date(s.start);
                return (
                  <button
                    key={i}
                    onClick={() => { setSlotIdx(i); setStep('confirm'); }}
                    className="p-3 border border-neutral-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 text-left transition-colors"
                  >
                    <p className="text-sm font-medium">{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-xs text-neutral-500">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {step === 'confirm' && slotIdx !== null && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setStep('slot')}>← Back</Button>
          <div className="bg-brand-50 rounded-xl p-4 text-sm">
            <p className="font-semibold text-brand-800">{TYPE_LABELS[typeId] ?? typeId}</p>
            <p className="text-brand-700 mt-1">
              {new Date(slots[slotIdx].start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
              {new Date(slots[slotIdx].start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any specific properties, questions, or requests?"
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
          <Button className="w-full" onClick={book} disabled={loading}>
            {loading ? 'Booking…' : 'Confirm Appointment Request'}
          </Button>
        </>
      )}
    </div>
  );
}
