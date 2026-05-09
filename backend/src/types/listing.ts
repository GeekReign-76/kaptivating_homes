/**
 * InternalListing — our normalized listing shape.
 * This is what gets written to the `listings` table.
 * Produced by normalizer.ts from a RESOListing.
 */

export interface ListingPhoto {
  url: string;
  order: number;
  caption: string | null;
}

export interface ListingFeatures {
  garage: boolean;
  pool: boolean;
  waterfront: boolean;
  new_construction: boolean;
  garage_spaces: number | null;
  heating: string[];
  cooling: string[];
  flooring: string[];
  appliances: string[];
  interior_features: string[];
  exterior_features: string[];
  architectural_style: string[];
}

export type MlsStatus =
  | 'Active'
  | 'Active Under Contract'
  | 'Pending'
  | 'Sold'
  | 'Withdrawn'
  | 'Expired'
  | 'Coming Soon';

export type PropertyType =
  | 'Single Family'
  | 'Condo'
  | 'Townhouse'
  | 'Multi-Family'
  | 'Land'
  | 'Commercial'
  | 'Other';

export type LotUnit = 'sqft' | 'acres';

export interface InternalListing {
  mls_id: string;
  mls_source: string;
  market_id: string;
  state: string;
  region: string | null;

  // Address
  address: string;
  city: string;
  county: string | null;
  zip: string;
  lat: number | null;
  lng: number | null;

  // Property details
  price: number | null;
  beds: number | null;
  baths: number | null;
  half_baths: number;
  sqft: number | null;
  lot_size: number | null;
  lot_unit: LotUnit;
  year_built: number | null;
  property_type: PropertyType;
  mls_status: MlsStatus;

  // Content
  description: string | null;
  photos: ListingPhoto[];
  features: ListingFeatures;

  // IDX attribution (required by all MLS compliance rules)
  listing_agent_name: string | null;
  listing_agent_mlsid: string | null;
  listing_office_name: string | null;
  listing_office_mlsid: string | null;

  // Timestamps
  listed_at: Date | null;
  price_changed_at: Date | null;
}

/**
 * Result of a bulk upsert operation
 */
export interface UpsertResult {
  inserted: number;
  updated: number;
  errors: Array<{ mls_id: string; error: string }>;
}

/**
 * Stats collected during a sync run
 */
export interface SyncStats {
  new_listings: number;
  updated_listings: number;
  removed_listings: number;
  error_count: number;
  error_details: Array<{ mls_id: string; error: string }>;
  duration_ms: number;
}
