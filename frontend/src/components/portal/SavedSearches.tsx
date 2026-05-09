'use client';

import { useEffect, useState } from 'react';
import Link    from 'next/link';
import { Bell, BellOff, Trash2, Search, Plus } from 'lucide-react';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api }     from '@/lib/apiClient';

export function SavedSearches() {
  const [searches, setSearches] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.savedSearches.list()
      .then((res: any) => setSearches(Array.isArray(res) ? res : []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleNotify(id: string, current: boolean) {
    await api.savedSearches.toggleNotify(id, !current);
    setSearches(prev => prev.map(s => s.id === id ? { ...s, notify_on_new_listings: !current } : s));
  }

  async function deleteSearch(id: string) {
    if (!confirm('Delete this saved search?')) return;
    await api.savedSearches.delete(id);
    setSearches(prev => prev.filter(s => s.id !== id));
  }

  function filterSummary(filters: any): string {
    const parts: string[] = [];
    if (filters.states?.length)        parts.push(filters.states.join(', '));
    if (filters.min_beds)              parts.push(`${filters.min_beds}+ beds`);
    if (filters.max_price)             parts.push(`Under $${(filters.max_price / 1000).toFixed(0)}k`);
    if (filters.min_price && !filters.max_price) parts.push(`Over $${(filters.min_price / 1000).toFixed(0)}k`);
    if (filters.city)                  parts.push(filters.city);
    return parts.join(' · ') || 'All properties';
  }

  function buildSearchUrl(filters: any): string {
    const params = new URLSearchParams();
    if (filters.states?.length)  params.set('states',    filters.states.join(','));
    if (filters.min_price)       params.set('min_price', String(filters.min_price));
    if (filters.max_price)       params.set('max_price', String(filters.max_price));
    if (filters.min_beds)        params.set('min_beds',  String(filters.min_beds));
    if (filters.city)            params.set('city',      filters.city);
    return `/listings?${params.toString()}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-serif font-bold text-neutral-900">Saved Searches</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/listings"><Plus className="w-3.5 h-3.5 mr-1" /> New Search</Link>
        </Button>
      </div>

      {/* Guest teaser (shown when list is empty and no searches) */}
      {!loading && searches.length === 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-6 text-center">
          <Search className="w-8 h-8 text-brand-400 mx-auto mb-3" />
          <p className="font-medium text-neutral-900 mb-1">Stay ahead of the market</p>
          <p className="text-sm text-neutral-500 mb-4">
            Save a search to get notified when new listings match your criteria.
          </p>
          <Button asChild size="sm">
            <Link href="/listings">Start Searching</Link>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <Link href={buildSearchUrl(s.filters)} className="font-medium text-neutral-900 hover:text-brand-600 text-sm">
                  {s.name}
                </Link>
                <p className="text-xs text-neutral-400 mt-0.5">{filterSummary(s.filters)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleNotify(s.id, s.notify_on_new_listings)}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
                  title={s.notify_on_new_listings ? 'Notifications on' : 'Notifications off'}
                >
                  {s.notify_on_new_listings
                    ? <Bell className="w-4 h-4 text-brand-500" />
                    : <BellOff className="w-4 h-4" />
                  }
                </button>
                <button
                  onClick={() => deleteSearch(s.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
