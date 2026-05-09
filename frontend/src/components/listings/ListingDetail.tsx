'use client';

import { useState } from 'react';
import Image        from 'next/image';
import Link         from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Bed, Bath, Maximize2, Phone, Mail, Calendar, MessageSquare, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { cn, formatPrice, formatSqft, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { api }     from '@/lib/apiClient';

interface ListingDetailProps { listing: any }

export function ListingDetail({ listing }: ListingDetailProps) {
  const { user }     = useAuth();
  const router       = useRouter();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [saved, setSaved]       = useState(false);
  const photos = listing.photos ?? [];

  async function handleSave() {
    if (!user) { router.push('/auth/login?next=' + encodeURIComponent(`/listings/${listing.id}`)); return; }
    setSaved(p => !p);
    saved ? await api.listings.unsave(listing.id) : await api.listings.save(listing.id);
  }

  function handleBook() {
    if (!user) { router.push('/auth/register?next=/portal/appointments'); return; }
    router.push('/portal/appointments');
  }

  function handleMessage() {
    if (!user) { router.push('/auth/register?next=/portal/messages'); return; }
    router.push(`/portal/messages`);
  }

  const isPending = listing.status === 'Pending';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/listings" className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to listings
      </Link>

      {isPending && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          This property is currently under contract.
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10">
        {/* Left: photos + details */}
        <div>
          {/* Photo gallery */}
          <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-neutral-100 mb-3">
            {photos[photoIdx] ? (
              <Image
                src={photos[photoIdx].url}
                alt={listing.address}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
                <Maximize2 className="w-16 h-16" />
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                  disabled={photoIdx === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center shadow hover:bg-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                  disabled={photoIdx === photos.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center shadow hover:bg-white disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {photoIdx + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
              {photos.map((p: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setPhotoIdx(i)}
                  className={cn('relative w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-colors',
                    i === photoIdx ? 'border-brand-500' : 'border-transparent')}
                >
                  <Image src={p.url} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-3xl font-bold text-neutral-900">{formatPrice(listing.price)}</p>
              <p className="text-lg font-medium text-neutral-800 mt-1">{listing.address}</p>
              <p className="text-neutral-500">{listing.city}, {listing.state} {listing.zip}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={listing.status === 'Active' ? 'success' : 'warning'}>{listing.status}</Badge>
              <button onClick={handleSave} className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50">
                <Heart className={cn('w-4 h-4', saved ? 'fill-red-500 text-red-500' : 'text-neutral-400')} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 py-4 border-y border-neutral-200 mb-6">
            {listing.beds  != null && <div className="text-center"><p className="text-xl font-bold">{listing.beds}</p><p className="text-xs text-neutral-500">Beds</p></div>}
            {listing.baths != null && <div className="text-center"><p className="text-xl font-bold">{listing.baths}</p><p className="text-xs text-neutral-500">Baths</p></div>}
            {listing.sqft  != null && <div className="text-center"><p className="text-xl font-bold">{formatSqft(listing.sqft)}</p><p className="text-xs text-neutral-500">Sq Ft</p></div>}
            {listing.property_type && <div className="text-center"><p className="text-xl font-bold text-sm">{listing.property_type}</p><p className="text-xs text-neutral-500">Type</p></div>}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mb-6">
              <h2 className="font-semibold text-neutral-900 mb-2">About This Property</h2>
              <p className="text-neutral-600 leading-relaxed">{listing.description}</p>
            </div>
          )}

          {/* Listed date */}
          {listing.listed_at && (
            <p className="text-xs text-neutral-400">Listed {formatDate(listing.listed_at)}</p>
          )}
        </div>

        {/* Right: sticky contact card */}
        <div className="mt-8 lg:mt-0">
          <div className="sticky top-24 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <p className="text-2xl font-bold text-neutral-900">{formatPrice(listing.price)}</p>
              {listing.sqft && listing.price && (
                <p className="text-sm text-neutral-500">${Math.round(listing.price / listing.sqft).toLocaleString()}/sqft</p>
              )}
            </div>

            <Button className="w-full" size="lg" onClick={handleBook}>
              <Calendar className="w-4 h-4 mr-2" /> Schedule a Tour
            </Button>
            <Button variant="outline" className="w-full" onClick={handleMessage}>
              <MessageSquare className="w-4 h-4 mr-2" /> Message Agent
            </Button>

            <div className="border-t border-neutral-100 pt-4">
              <p className="font-medium text-neutral-900 text-sm">{process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Your Agent'}</p>
              <p className="text-xs text-neutral-500 mb-3">{process.env.NEXT_PUBLIC_AGENT_TITLE ?? 'Real Estate Agent'}</p>
              {process.env.NEXT_PUBLIC_AGENT_PHONE && (
                <a href={`tel:${process.env.NEXT_PUBLIC_AGENT_PHONE}`} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-brand-500 mb-1">
                  <Phone className="w-3.5 h-3.5" /> {process.env.NEXT_PUBLIC_AGENT_PHONE}
                </a>
              )}
              {process.env.NEXT_PUBLIC_AGENT_EMAIL && (
                <a href={`mailto:${process.env.NEXT_PUBLIC_AGENT_EMAIL}`} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-brand-500">
                  <Mail className="w-3.5 h-3.5" /> {process.env.NEXT_PUBLIC_AGENT_EMAIL}
                </a>
              )}
            </div>

            {!user && (
              <p className="text-xs text-neutral-400 text-center">
                <Link href="/auth/register" className="text-brand-500 hover:underline">Create an account</Link> to save homes and message directly.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
