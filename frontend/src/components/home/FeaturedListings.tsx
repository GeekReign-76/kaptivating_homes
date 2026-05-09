'use client';

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import { ListingCard }         from '@/components/listings/ListingCard';
import { Skeleton }            from '@/components/ui/skeleton';
import { Button }              from '@/components/ui/button';
import { api }                 from '@/lib/apiClient';
import { ArrowRight }          from 'lucide-react';

export function FeaturedListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.listings.list({ limit: 6, status: 'Active' })
      .then((res: any) => setListings(res.data ?? res ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-wide mb-1">Browse Properties</p>
            <h2 className="font-serif text-3xl font-bold text-neutral-900">Featured Properties</h2>
          </div>
          <Link href="/listings" className="hidden sm:flex items-center gap-1 text-sm text-brand-500 hover:text-brand-700 font-medium">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}

        <div className="mt-10 text-center sm:hidden">
          <Button variant="outline" asChild>
            <Link href="/listings">View All Listings <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
