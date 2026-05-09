'use client';

import { useEffect, useState } from 'react';
import { Plus, Star, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Badge }    from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { api }      from '@/lib/apiClient';
import { cn, formatPrice } from '@/lib/utils';

const BLANK = { address: '', city: '', state: 'SC', zip: '', price: '', beds: '', baths: '', sqft: '', property_type: 'Residential', status: 'Active', description: '', is_starred: false };

export function ListingsManager() {
  const [mlsListings,    setMlsListings]    = useState<any[]>([]);
  const [manualListings, setManualListings] = useState<any[]>([]);
  const [loading, setLoading]    = useState(true);
  const [syncing, setSyncing]    = useState(false);
  const [dialog,  setDialog]     = useState<'new' | 'edit' | null>(null);
  const [editId,  setEditId]     = useState<string | null>(null);
  const [form,    setForm]       = useState<typeof BLANK>({ ...BLANK });
  const [saving,  setSaving]     = useState(false);

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    const res: any = await api.listings.list({ limit: 50 });
    const all: any[] = res.data ?? res ?? [];
    setMlsListings(all.filter((l: any) => l.source === 'mls'));
    setManualListings(all.filter((l: any) => l.source === 'manual'));
    setLoading(false);
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }));
  }

  function openNew() {
    setForm({ ...BLANK });
    setEditId(null);
    setDialog('new');
  }

  function openEdit(listing: any) {
    setForm({
      address: listing.address, city: listing.city, state: listing.state, zip: listing.zip ?? '',
      price: String(listing.price), beds: String(listing.beds ?? ''), baths: String(listing.baths ?? ''),
      sqft: String(listing.sqft ?? ''), property_type: listing.property_type, status: listing.status,
      description: listing.description ?? '', is_starred: listing.is_starred ?? false,
    });
    setEditId(listing.id);
    setDialog('edit');
  }

  async function saveForm() {
    setSaving(true);
    const body = { ...form, price: Number(form.price), beds: form.beds ? Number(form.beds) : null, baths: form.baths ? Number(form.baths) : null, sqft: form.sqft ? Number(form.sqft) : null };
    try {
      if (dialog === 'new') {
        const newL = await api.listings.createManual(body);
        setManualListings(prev => [newL, ...prev]);
      } else if (editId) {
        const updated = await api.listings.updateManual(editId, body);
        setManualListings(prev => prev.map(l => l.id === editId ? { ...l, ...updated } : l));
      }
      setDialog(null);
    } finally { setSaving(false); }
  }

  async function deleteListing(id: string) {
    if (!confirm('Remove this listing?')) return;
    await api.listings.deleteManual(id);
    setManualListings(prev => prev.filter(l => l.id !== id));
  }

  async function toggleStar(id: string, current: boolean) {
    await api.listings.toggleStar(id, !current);
    setManualListings(prev => prev.map(l => l.id === id ? { ...l, is_starred: !current } : l));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Listings</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Listing</Button>
      </div>

      <Tabs defaultValue="manual">
        <TabsList className="mb-6">
          <TabsTrigger value="manual">My Listings ({manualListings.length})</TabsTrigger>
          <TabsTrigger value="mls">MLS Feed ({mlsListings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : manualListings.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <p className="text-sm mb-3">No manual listings yet.</p>
              <Button variant="outline" size="sm" onClick={openNew}>Add Your First Listing</Button>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
              {manualListings.map((l: any) => (
                <div key={l.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{l.address}, {l.city}, {l.state}</p>
                    <p className="text-xs text-neutral-400">{formatPrice(l.price)} · {l.beds}bd/{l.baths}ba</p>
                  </div>
                  <Badge variant={l.status === 'Active' ? 'success' : 'secondary'} className="text-xs shrink-0">{l.status}</Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleStar(l.id, l.is_starred)} className="p-1.5 rounded hover:bg-neutral-100">
                      <Star className={cn('w-4 h-4', l.is_starred ? 'fill-amber-400 text-amber-400' : 'text-neutral-300')} />
                    </button>
                    <button onClick={() => openEdit(l)} className="p-1.5 rounded hover:bg-neutral-100">
                      <Pencil className="w-4 h-4 text-neutral-400" />
                    </button>
                    <button onClick={() => deleteListing(l.id)} className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-neutral-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mls">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-500">{mlsListings.length} synced properties</p>
            <Button variant="outline" size="sm" disabled={syncing} onClick={() => setSyncing(true)}>
              <RefreshCw className={cn('w-4 h-4 mr-1.5', syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Force Sync'}
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
              {mlsListings.map((l: any) => (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{l.address}, {l.city}, {l.state}</p>
                    <p className="text-xs text-neutral-400">{formatPrice(l.price)} · MLS {l.mls_id}</p>
                  </div>
                  <Badge variant={l.status === 'Active' ? 'success' : 'warning'} className="text-xs shrink-0">{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit dialog */}
      <Dialog open={!!dialog} onOpenChange={o => { if (!o) setDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog === 'new' ? 'Add New Listing' : 'Edit Listing'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label>Address *</Label>
              <Input value={form.address} onChange={f('address')} placeholder="123 Main St" className="mt-1" />
            </div>
            <div><Label>City *</Label><Input value={form.city} onChange={f('city')} className="mt-1" /></div>
            <div>
              <Label>State *</Label>
              <select value={form.state} onChange={f('state') as any} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {['SC','GA','FL'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Zip</Label><Input value={form.zip} onChange={f('zip')} className="mt-1" /></div>
            <div><Label>Price *</Label><Input type="number" value={form.price} onChange={f('price')} placeholder="500000" className="mt-1" /></div>
            <div><Label>Beds</Label><Input type="number" value={form.beds} onChange={f('beds')} className="mt-1" /></div>
            <div><Label>Baths</Label><Input type="number" value={form.baths} onChange={f('baths')} className="mt-1" /></div>
            <div><Label>Sqft</Label><Input type="number" value={form.sqft} onChange={f('sqft')} className="mt-1" /></div>
            <div>
              <Label>Type</Label>
              <select value={form.property_type} onChange={f('property_type') as any} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {['Residential','Condo','Land','Commercial','MultiFamily'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={f('status') as any} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {['Active','Pending','Sold','Off Market'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <textarea value={form.description} onChange={f('description')} rows={3} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="starred" checked={form.is_starred} onChange={e => setForm(p => ({ ...p, is_starred: e.target.checked }))} className="accent-brand-500" />
              <label htmlFor="starred" className="text-sm text-neutral-700 cursor-pointer">Feature this listing (show Star badge)</label>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={saveForm} disabled={saving || !form.address || !form.price}>
              {saving ? 'Saving…' : dialog === 'new' ? 'Add Listing' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
