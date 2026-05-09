'use client';

import { useEffect, useRef, useCallback } from 'react';
import { PropertyInterestPrompt }         from './PropertyInterestPrompt';

export function KwSearchPane({ initialQuery = '' }: { initialQuery?: string }) {
  const armRef = useRef<((context: string) => void) | null>(null);

  const onArm = useCallback((fn: (context: string) => void) => {
    armRef.current = fn;
  }, []);

  // ── Listen for search submissions posted from the iframe ──────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'kw-search') return;
      const { query, searchType } = e.data as { query: string; searchType: string };

      armRef.current?.(`Browsing listings: "${query}" (${searchType})`);

      // Log search intent — backend will 400 without email, caught silently
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source:  'listing-search',
          context: `Search: "${query}" (${searchType})`,
        }),
      }).catch(() => {});
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const src = initialQuery
    ? `/api/kw-search-widget?q=${encodeURIComponent(initialQuery)}`
    : '/api/kw-search-widget';

  return (
    <>
      <iframe
        src={src}
        title="Search Listings — Kaptivating Homes by Karsten"
        className="w-full h-full block border-0"
        allow="geolocation"
      />
      <PropertyInterestPrompt onArm={onArm} />
    </>
  );
}
