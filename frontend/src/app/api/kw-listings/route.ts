import { NextResponse } from 'next/server';
import STATIC_LISTINGS from './kw-listings-cache.json';

/**
 * GET /api/kw-listings
 *
 * Returns Karsten's active KW listings.
 * Serves a static cache parsed from karstenmiller.kw.com.
 * Update kw-listings-cache.json whenever listings change.
 */

export const revalidate = false; // static — no revalidation needed

export async function GET() {
  return NextResponse.json({ data: STATIC_LISTINGS, error: null });
}
