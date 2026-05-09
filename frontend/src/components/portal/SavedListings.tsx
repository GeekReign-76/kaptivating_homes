'use client';

import { useEffect, useState } from 'react';
import Link     from 'next/link';
import { ListingCard } from '@/components/listings/ListingCard';
import { Skeleton }    from '@/components/ui/skeleton';
import { Button }      from '@/components/ui/button';
import { api }         from '@/lib/apiClient';
import { Heart }       from 'lucide-react';

export function SavedListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.listings.saved()
      .then((res: any) => setListings(Array.isArray(res) ? res : res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  function handleUnsave(id: string) {
    api.listings.unsave(id);
    setListings(prev => prev.filter(l => l.id !== id));
  }

  return (
    <div>
      <h2 className="text-xl font-serif font-bold text-neutral-900 mb-5">Saved Homes</h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl overflow-hidden border border-neutral-200">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm mb-3">No saved homes yet.</p>
          <Button variant="outline" asChild size="sm">
            <Link href="/listings">Browse Listings</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((l: any) => (
            <ListingCard key={l.id} listing={l} saved onSaveToggle={handleUnsave} />
          ))}
        </div>
      )}
    </div>
  );
}
