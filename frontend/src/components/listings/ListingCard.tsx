'use client';

import { useState } from 'react';
import Link         from 'next/link';
import Image        from 'next/image';
import { Heart, Bed, Bath, Maximize2, Star } from 'lucide-react';
import { Badge }    from '@/components/ui/badge';
import { cn, formatPrice, formatSqft } from '@/lib/utils';

interface ListingCardProps {
  listing:       any;
  saved?:        boolean;
  onSaveToggle?: (id: string) => void;
  href?:         string;    // override the default /listings/:id link
  onClick?:      () => void; // called before navigation (e.g. to arm a prompt)
}

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }> = {
  Active:  { label: 'Active',       variant: 'success'     },
  Pending: { label: 'Under Contract', variant: 'warning'   },
  Sold:    { label: 'Sold',         variant: 'destructive' },
  Closed:  { label: 'Closed',       variant: 'secondary'   },
};

export function ListingCard({ listing, saved = false, onSaveToggle, href, onClick }: ListingCardProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [isSaved,  setIsSaved]  = useState(saved);
  const photos = listing.photos ?? [];
  const photo  = photos[photoIdx]?.url ?? null;
  const status = STATUS_BADGE[listing.status] ?? { label: listing.status, variant: 'secondary' as const };

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(p => !p);
    onSaveToggle?.(listing.id);
  }

  return (
    <Link
      href={href ?? `/listings/${listing.id}`}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      className="group block bg-white rounded-xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-neutral-100">
        {photo ? (
          <Image
            src={photo}
            alt={listing.address}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <Maximize2 className="w-12 h-12" />
          </div>
        )}

        {/* Overlays */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {listing.is_starred && (
            <Badge variant="default" className="gap-1">
              <Star className="w-3 h-3 fill-current" /> Featured
            </Badge>
          )}
        </div>

        {/* Save button */}
        {onSaveToggle && (
          <button
            onClick={handleSave}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white transition-colors"
            aria-label={isSaved ? 'Unsave' : 'Save'}
          >
            <Heart className={cn('w-4 h-4 transition-colors', isSaved ? 'fill-red-500 text-red-500' : 'text-neutral-400')} />
          </button>
        )}

        {/* Photo dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {photos.map((_: any, i: number) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setPhotoIdx(i); }}
                className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === photoIdx ? 'bg-white' : 'bg-white/50')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xl font-bold text-neutral-900">{formatPrice(listing.price)}</p>
        <p className="text-sm font-medium text-neutral-800 mt-0.5 truncate">{listing.address}</p>
        <p className="text-xs text-neutral-500">{listing.city}, {listing.state} {listing.zip}</p>

        <div className="flex items-center gap-4 mt-3 text-xs text-neutral-600">
          {listing.beds != null && (
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" /> {listing.beds} {listing.beds === 1 ? 'bed' : 'beds'}
            </span>
          )}
          {listing.baths != null && (
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" /> {listing.baths} {listing.baths === 1 ? 'bath' : 'baths'}
            </span>
          )}
          {listing.sqft != null && (
            <span className="flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5" /> {formatSqft(listing.sqft)} sqft
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
