'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams }        from 'next/navigation';
import { ListingCard }    from './ListingCard';
import { SearchFilters, type Filters } from './SearchFilters';
import { Skeleton }       from '@/components/ui/skeleton';
import { Button }         from '@/components/ui/button';
import { api }            from '@/lib/apiClient';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';

const PAGE_SIZE = 12;

function paramsToFilters(sp: URLSearchParams): Partial<Filters> {
  return {
    states:        sp.get('states')?.split(',').filter(Boolean) ?? [],
    property_type: sp.get('property_type')?.split(',').filter(Boolean) ?? [],
    min_price:     sp.get('min_price') ?? '',
    max_price:     sp.get('max_price') ?? '',
    min_beds:      sp.get('min_beds')  ?? '',
    min_baths:     sp.get('min_baths') ?? '',
    sort:          sp.get('sort')      ?? 'listed_at:desc',
  };
}

export function ListingsPageClient() {
  const router     = useRouter();
  const sp         = useSearchParams();
  const [listings, setListings] = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState<Partial<Filters>>(paramsToFilters(sp));

  const load = useCallback(async (f: Partial<Filters>, p: number) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: PAGE_SIZE, status: 'Active,Pending' };
      if (f.states?.length)        params.states        = f.states.join(',');
      if (f.property_type?.length) params.property_type = f.property_type.join(',');
      if (f.min_price)             params.min_price     = f.min_price;
      if (f.max_price)             params.max_price     = f.max_price;
      if (f.min_beds)              params.min_beds      = f.min_beds;
      if (f.min_baths)             params.min_baths     = f.min_baths;
      if (f.sort)                  params.sort          = f.sort;

      const res: any = await api.listings.list(params);
      setListings(res.data ?? res ?? []);
      setTotal(res.meta?.total ?? (res.data ?? res ?? []).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page, load]);

  function onFilterChange(f: Filters) {
    setFilters(f);
    setPage(1);
    // Sync to URL
    const params = new URLSearchParams();
    if (f.states?.length)        params.set('states',        f.states.join(','));
    if (f.property_type?.length) params.set('property_type', f.property_type.join(','));
    if (f.min_price)             params.set('min_price',     f.min_price);
    if (f.max_price)             params.set('max_price',     f.max_price);
    if (f.min_beds)              params.set('min_beds',      f.min_beds);
    if (f.min_baths)             params.set('min_baths',     f.min_baths);
    if (f.sort && f.sort !== 'listed_at:desc') params.set('sort', f.sort);
    router.push(`/listings?${params.toString()}`, { scroll: false });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Property Search</h1>
        {!loading && (
          <p className="text-sm text-neutral-500 mt-1">
            {total === 0 ? 'No properties found' : `${total.toLocaleString()} propert${total === 1 ? 'y' : 'ies'} found`}
          </p>
        )}
      </div>

      <div className="flex gap-8 items-start">
        <SearchFilters initial={filters} onChange={onFilterChange} />

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-neutral-200">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Home className="w-12 h-12 text-neutral-300 mb-4" />
              <p className="text-lg font-semibold text-neutral-600">No properties found</p>
              <p className="text-sm text-neutral-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {listings.map((l: any) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-10">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-sm text-neutral-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
