'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ListingCard }            from '@/components/listings/ListingCard';
import { PropertyInterestPrompt } from '@/components/listings/PropertyInterestPrompt';
import { Skeleton }               from '@/components/ui/skeleton';
import { Button }                 from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 6;

export function KwListingsGrid() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);

  const armPromptRef = useRef<((context: string) => void) | null>(null);
  const onArm = useCallback((fn: (context: string) => void) => {
    armPromptRef.current = fn;
  }, []);

  useEffect(() => {
    fetch('/api/kw-listings')
      .then(r => r.json())
      .then(res => setListings(res.data ?? []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPages  = Math.ceil(listings.length / PAGE_SIZE);
  const pageStart   = (page - 1) * PAGE_SIZE;
  const pageEnd     = pageStart + PAGE_SIZE;
  const pageListing = listings.slice(pageStart, pageEnd);

  function goTo(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-neutral-200">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          <p className="text-lg">No listings available right now.</p>
          <p className="text-sm mt-1">Check back soon or contact Karsten directly.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageListing.map(l => (
              <ListingCard
                key={l.id}
                listing={l}
                href={l.href}
                onClick={() => armPromptRef.current?.(
                  `${l.address}, ${l.city}, ${l.state} — $${l.price.toLocaleString()}`
                )}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goTo(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => goTo(p)}
                  className="w-9"
                >
                  {p}
                </Button>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => goTo(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-neutral-400">
            Showing {pageStart + 1}–{Math.min(pageEnd, listings.length)} of {listings.length} listings
          </p>
        </>
      )}

      <PropertyInterestPrompt onArm={onArm} />
    </>
  );
}
