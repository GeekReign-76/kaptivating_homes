'use client';

import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, CheckCircle, Loader2, Clock } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';
import { cn }       from '@/lib/utils';

const TIMES = Array.from({ length: 28 }, (_, i) => {
  const totalMins = 7 * 60 + i * 30; // 7:00am to 9:30pm in 30-min steps
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const label = `${h > 12 ? h - 12 : h}:${m === 0 ? '00' : '30'} ${h >= 12 ? 'PM' : 'AM'}`;
  const value = `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`;
  return { label, value };
});

type DayRow = { day_of_week: number; label: string; enabled: boolean; start_time: string; end_time: string };
type ApptType = { id: string; name: string; duration_minutes: number; buffer_minutes: number; description: string; enabled: boolean };

type SaveState = 'idle' | 'saving' | 'saved';

export function ScheduleManager() {
  const [availability,  setAvailability]  = useState<DayRow[]>([]);
  const [apptTypes,     setApptTypes]     = useState<ApptType[]>([]);
  const [blockedDates,  setBlockedDates]  = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saveState,     setSaveState]     = useState<SaveState>('idle');
  const [newDate,       setNewDate]       = useState('');
  const [editingType,   setEditingType]   = useState<string | null>(null);
  const [typeDraft,     setTypeDraft]     = useState<Partial<ApptType>>({});

  useEffect(() => {
    Promise.all([
      (api.schedule as any).getAvailability(),
      (api.schedule as any).getBlockedDates(),
      (api.schedule as any).getAppointmentTypes(),
    ]).then(([avail, blocked, types]) => {
      setAvailability(avail);
      setBlockedDates(blocked);
      setApptTypes(types);
    }).finally(() => setLoading(false));
  }, []);

  // ---- Weekly Hours ----

  function toggleDay(dow: number) {
    setAvailability(prev => prev.map(d => d.day_of_week === dow ? { ...d, enabled: !d.enabled } : d));
  }

  function setTime(dow: number, field: 'start_time' | 'end_time', value: string) {
    setAvailability(prev => prev.map(d => d.day_of_week === dow ? { ...d, [field]: value } : d));
  }

  async function saveAvailability() {
    setSaveState('saving');
    await (api.schedule as any).updateAvailability(availability);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2500);
  }

  // ---- Blocked Dates ----

  async function addBlockedDate() {
    if (!newDate || blockedDates.includes(newDate)) return;
    await (api.schedule as any).addBlockedDate(newDate);
    setBlockedDates(prev => [...prev, newDate].sort());
    setNewDate('');
  }

  async function removeBlockedDate(date: string) {
    await (api.schedule as any).removeBlockedDate(date);
    setBlockedDates(prev => prev.filter(d => d !== date));
  }

  function formatBlockedDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }

  // ---- Appointment Types ----

  function startEdit(type: ApptType) {
    setEditingType(type.id);
    setTypeDraft({ ...type });
  }

  async function saveType() {
    if (!editingType) return;
    await (api.schedule as any).updateAppointmentType(editingType, typeDraft);
    setApptTypes(prev => prev.map(t => t.id === editingType ? { ...t, ...typeDraft } : t));
    setEditingType(null);
    setTypeDraft({});
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-neutral-900 mb-6">Schedule</h1>

      <Tabs defaultValue="hours">
        <TabsList className="mb-6">
          <TabsTrigger value="hours">Weekly Hours</TabsTrigger>
          <TabsTrigger value="blocked">Blocked Dates</TabsTrigger>
          <TabsTrigger value="types">Appointment Types</TabsTrigger>
        </TabsList>

        {/* ---- Weekly Hours ---- */}
        <TabsContent value="hours">
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {availability.map((day) => (
              <div key={day.day_of_week} className={cn('flex items-center gap-4 px-5 py-4 border-b border-neutral-100 last:border-0', !day.enabled && 'opacity-50')}>
                {/* Toggle */}
                <button
                  onClick={() => toggleDay(day.day_of_week)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors shrink-0',
                    day.enabled ? 'bg-brand-500' : 'bg-neutral-300',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    day.enabled ? 'translate-x-5' : 'translate-x-0.5',
                  )} />
                </button>

                {/* Day label */}
                <p className="w-24 text-sm font-medium text-neutral-700 shrink-0">{day.label}</p>

                {day.enabled ? (
                  <div className="flex items-center gap-3 flex-1">
                    <select
                      value={day.start_time}
                      onChange={e => setTime(day.day_of_week, 'start_time', e.target.value)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {TIMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span className="text-neutral-400 text-sm">to</span>
                    <select
                      value={day.end_time}
                      onChange={e => setTime(day.day_of_week, 'end_time', e.target.value)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {TIMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 flex-1">Unavailable</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Times shown in your local timezone
            </p>
            <Button onClick={saveAvailability} disabled={saveState === 'saving'}>
              {saveState === 'saving' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {saveState === 'saved' && <CheckCircle className="w-4 h-4 mr-1.5" />}
              {saveState === 'idle' && <Save className="w-4 h-4 mr-1.5" />}
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save Hours'}
            </Button>
          </div>
        </TabsContent>

        {/* ---- Blocked Dates ---- */}
        <TabsContent value="blocked">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-4">
            <p className="text-sm font-medium text-neutral-700 mb-3">Add a blocked date</p>
            <div className="flex gap-3">
              <Input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="max-w-xs"
              />
              <Button onClick={addBlockedDate} disabled={!newDate}>
                <Plus className="w-4 h-4 mr-1" /> Block Date
              </Button>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Clients won't be able to book appointments on blocked dates.</p>
          </div>

          {blockedDates.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">No blocked dates.</div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              {blockedDates.map(date => (
                <div key={date} className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 last:border-0">
                  <p className="text-sm text-neutral-800">{formatBlockedDate(date)}</p>
                  <button
                    onClick={() => removeBlockedDate(date)}
                    className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Appointment Types ---- */}
        <TabsContent value="types">
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {apptTypes.map(type => (
              <div key={type.id} className="border-b border-neutral-100 last:border-0">
                {editingType === type.id ? (
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-neutral-500">Name</Label>
                        <Input
                          value={typeDraft.name ?? ''}
                          onChange={e => setTypeDraft(p => ({ ...p, name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-neutral-500">Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={typeDraft.duration_minutes ?? ''}
                          onChange={e => setTypeDraft(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-neutral-500">Buffer between appointments (minutes)</Label>
                        <Input
                          type="number"
                          value={typeDraft.buffer_minutes ?? ''}
                          onChange={e => setTypeDraft(p => ({ ...p, buffer_minutes: Number(e.target.value) }))}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={typeDraft.enabled ?? true}
                            onChange={e => setTypeDraft(p => ({ ...p, enabled: e.target.checked }))}
                            className="accent-brand-500"
                          />
                          Enabled (visible to clients)
                        </label>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-neutral-500">Description</Label>
                        <textarea
                          value={typeDraft.description ?? ''}
                          onChange={e => setTypeDraft(p => ({ ...p, description: e.target.value }))}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveType}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingType(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', type.enabled ? 'bg-green-500' : 'bg-neutral-300')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{type.name}</p>
                      <p className="text-xs text-neutral-400">{type.duration_minutes} min · {type.buffer_minutes} min buffer</p>
                    </div>
                    <p className="text-xs text-neutral-500 hidden sm:block max-w-xs truncate">{type.description}</p>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(type)}>Edit</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
