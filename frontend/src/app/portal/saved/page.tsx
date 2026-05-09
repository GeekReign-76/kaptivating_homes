import type { Metadata } from 'next';
import { SavedListings } from '@/components/portal/SavedListings';
import { SavedSearches } from '@/components/portal/SavedSearches';

export const metadata: Metadata = { title: 'Saved Homes & Searches' };

export default function SavedPage() {
  return (
    <div className="space-y-10">
      <SavedListings />
      <SavedSearches />
    </div>
  );
}
