'use client';

import { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Input }    from '@/components/ui/input';
import { Badge }    from '@/components/ui/badge';
import { Button }   from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';
import { cn, formatDate } from '@/lib/utils';

const STATUSES = ['all', 'hot', 'warm', 'cold', 'closed'] as const;
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  hot:    { bg: 'bg-red-100',    text: 'text-red-700'    },
  warm:   { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  cold:   { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  closed: { bg: 'bg-neutral-100', text: 'text-neutral-500' },
};
const SOURCE_LABELS: Record<string, string> = {
  contact_form: 'Contact Form',
  chat:         'Chat',
  mls_match:    'MLS Match',
  referral:     'Referral',
};

export function LeadsDashboard() {
  const [leads,    setLeads]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState<typeof STATUSES[number]>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    api.leads.list().then((res: any) => {
      setLeads(Array.isArray(res) ? res : res.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l => {
    if (status !== 'all' && l.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      return l.user?.full_name?.toLowerCase().includes(s) || l.user?.email?.toLowerCase().includes(s);
    }
    return true;
  });

  async function updateStatus(id: string, newStatus: string) {
    await api.leads.update(id, { status: newStatus });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  }

  async function saveNotes(id: string) {
    await api.leads.update(id, { notes: noteDraft });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: noteDraft } : l));
    setEditing(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-neutral-900 mb-6">Leads</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
                status === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400 text-sm">No leads found.</div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-neutral-100">
            {filtered.map((lead: any) => (
              <div key={lead.id}>
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 cursor-pointer" onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}>
                  <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                    {lead.user?.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{lead.user?.full_name}</p>
                    <p className="text-xs text-neutral-400">{lead.user?.email}</p>
                  </div>
                  <Badge variant="secondary" className={cn('text-xs capitalize shrink-0', STATUS_COLORS[lead.status]?.bg, STATUS_COLORS[lead.status]?.text)}>
                    {lead.status}
                  </Badge>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0', 'bg-neutral-100 text-neutral-500')}>
                    {SOURCE_LABELS[lead.source] ?? lead.source}
                  </span>
                  <span className="text-xs text-neutral-400 hidden md:block shrink-0">{formatDate(lead.created_at)}</span>
                  <ChevronRight className={cn('w-4 h-4 text-neutral-400 shrink-0 transition-transform', expanded === lead.id && 'rotate-90')} />
                </div>

                {/* Expanded detail */}
                {expanded === lead.id && (
                  <div className="px-5 pb-5 bg-neutral-50 border-t border-neutral-100">
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Status changer */}
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">Status</p>
                        <div className="flex gap-2 flex-wrap">
                          {(['hot','warm','cold','closed'] as const).map(s => (
                            <button
                              key={s}
                              onClick={() => updateStatus(lead.id, s)}
                              className={cn(
                                'text-xs px-3 py-1 rounded-full capitalize border transition-colors',
                                lead.status === s
                                  ? `${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].text} border-transparent`
                                  : 'border-neutral-200 hover:border-neutral-300',
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">Notes</p>
                        {editing === lead.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={noteDraft}
                              onChange={e => setNoteDraft(e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveNotes(lead.id)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="text-sm text-neutral-600 cursor-pointer hover:text-neutral-900"
                            onClick={() => { setEditing(lead.id); setNoteDraft(lead.notes ?? ''); }}
                          >
                            {lead.notes || <span className="italic text-neutral-400">Click to add notes…</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
