'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter }        from 'next/navigation';
import Image                from 'next/image';
import { Search }                   from 'lucide-react';
import { Button }                   from '@/components/ui/button';
import { PropertyInterestPrompt }   from '@/components/listings/PropertyInterestPrompt';

export function HeroSection() {
  const router   = useRouter();
  const [query, setQuery] = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  const armRef    = useRef<((ctx: string) => void) | null>(null);
  const onArm     = useCallback((fn: (ctx: string) => void) => { armRef.current = fn; }, []);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      armRef.current?.(`Browsing listings: "${trimmed}"`);
      router.push(`/listings?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/listings');
    }
  }

  return (
    <>
    <section className="relative min-h-[85vh] flex items-center">
      {/* Background image */}
      <Image
        src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600"
        alt="Beautiful home exterior"
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />

      {/* KW Ballantyne badge — bottom-right corner */}
      <div className="absolute bottom-6 right-6 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg inline-flex items-center">
          <Image
            src="/kw-ballantyne-logo.png"
            alt="Keller Williams Charlotte Ballantyne Area Realty"
            width={120}
            height={45}
            className="object-contain"
          />
        </div>
      </div>

      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
          Your Next Home Is Just a Click Away
        </h1>
        <p className="text-white/80 text-lg sm:text-xl mb-10 max-w-2xl mx-auto">
          Real Estate Without The Hassle — {process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Karsten Miller'}, REALTOR®,
          helping you from start to finish across Charlotte and the greater region.
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-2xl shadow-2xl p-2 flex gap-2 max-w-xl mx-auto"
        >
          <div className="flex-1 flex items-center gap-3 px-4">
            <Search className="w-5 h-5 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="City, neighborhood, address, or zip code"
              className="flex-1 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none bg-transparent"
            />
          </div>
          <Button type="submit" size="lg" className="shrink-0 rounded-xl px-6">
            Search
          </Button>
        </form>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mt-12 text-white/90">
          {[
            ['150+', 'Homes Sold'],
            ['3',    'States'],
            ['10+',  'Years Exp.'],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold font-serif">{val}</p>
              <p className="text-xs text-white/60">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <PropertyInterestPrompt onArm={onArm} />
    </>
  );
}
