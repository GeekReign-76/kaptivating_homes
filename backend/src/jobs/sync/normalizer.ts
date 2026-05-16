import { RESOListing, RESOMedia } from '../../types/reso';
import {
  InternalListing,
  ListingFeatures,
  ListingPhoto,
  LotUnit,
  MlsStatus,
  PropertyType,
} from '../../types/listing';

/**
 * normalizeRESOListing
 *
 * Pure function: RESOListing + marketId → InternalListing
 *
 * No database or network calls. Fully unit testable.
 * All field mapping, type coercion, and cleanup lives here.
 */
export function normalizeRESOListing(raw: RESOListing, marketId: string): InternalListing {
  return {
    mls_id:               raw.ListingKey,
    mls_source:           raw.OriginatingSystemName,
    market_id:            marketId,
    state:                normalizeState(raw.StateOrProvince),
    region:               null, // populated later via geo lookup if needed

    address:              buildAddress(raw),
    city:                 raw.City?.trim() ?? '',
    county:               raw.CountyOrParish?.trim() ?? null,
    zip:                  raw.PostalCode?.trim() ?? '',
    lat:                  raw.Latitude ?? null,
    lng:                  raw.Longitude ?? null,

    price:                raw.ListPrice ?? null,
    beds:                 raw.BedroomsTotal ?? null,
    baths:                raw.BathroomsTotalDecimal ?? null,
    half_baths:           raw.BathroomsHalf ?? 0,
    sqft:                 raw.LivingArea ? Math.round(raw.LivingArea) : null,
    lot_size:             raw.LotSizeArea ?? null,
    lot_unit:             normalizeLotUnit(raw.LotSizeUnits),
    year_built:           raw.YearBuilt ?? null,
    property_type:        normalizePropertyType(raw.PropertyType, raw.PropertySubType),
    mls_status:           normalizeMlsStatus(raw.StandardStatus),

    description:          cleanText(raw.PublicRemarks),
    photos:               normalizePhotos(raw.Media),
    features:             normalizeFeatures(raw),

    listing_agent_name:   raw.ListAgentFullName?.trim() ?? null,
    listing_agent_mlsid:  raw.ListAgentMlsId?.trim() ?? null,
    listing_office_name:  raw.ListOfficeName?.trim() ?? null,
    listing_office_mlsid: raw.ListOfficeMlsId?.trim() ?? null,

    listed_at:            raw.ListingContractDate ? new Date(raw.ListingContractDate) : null,
    price_changed_at:     raw.PriceChangeTimestamp ? new Date(raw.PriceChangeTimestamp) : null,
  };
}

// -----------------------------------------------------------------------------
// Address
// -----------------------------------------------------------------------------

function buildAddress(raw: RESOListing): string {
  const parts: string[] = [];

  const streetNum = raw.StreetNumber?.trim() ?? '';
  if (streetNum) parts.push(streetNum);

  if (raw.StreetDirPrefix?.trim()) parts.push(raw.StreetDirPrefix.trim());
  if (raw.StreetName?.trim()) parts.push(raw.StreetName.trim());
  if (raw.StreetSuffix?.trim()) parts.push(raw.StreetSuffix.trim());
  if (raw.StreetDirSuffix?.trim()) parts.push(raw.StreetDirSuffix.trim());
  if (raw.UnitNumber?.trim()) parts.push(`Unit ${raw.UnitNumber.trim()}`);

  return parts.join(' ').trim();
}

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

function normalizeState(value?: string): string {
  if (!value) return '';
  const upper = value.toUpperCase().trim();
  // Handle full state names just in case
  const STATE_MAP: Record<string, string> = {
    'SOUTH CAROLINA': 'SC',
    'GEORGIA': 'GA',
    'FLORIDA': 'FL',
  };
  return STATE_MAP[upper] ?? upper;
}

// -----------------------------------------------------------------------------
// Property Type
// -----------------------------------------------------------------------------

const PROPERTY_TYPE_MAP: Array<{ patterns: string[]; normalized: PropertyType }> = [
  {
    patterns: ['single family', 'single family residence', 'residential', 'detached'],
    normalized: 'Single Family',
  },
  {
    patterns: ['condominium', 'condo', 'condo/coop'],
    normalized: 'Condo',
  },
  {
    patterns: ['townhouse', 'townhome', 'town house'],
    normalized: 'Townhouse',
  },
  {
    patterns: ['multi family', 'multifamily', 'multi-family', '2-4 units', 'duplex', 'triplex', 'fourplex'],
    normalized: 'Multi-Family',
  },
  {
    patterns: ['land', 'lots and land', 'vacant land', 'lot', 'acreage'],
    normalized: 'Land',
  },
  {
    patterns: ['commercial', 'commercial sale', 'retail', 'office', 'industrial'],
    normalized: 'Commercial',
  },
];

function normalizePropertyType(
  propertyType?: string,
  propertySubType?: string,
): PropertyType {
  // Prefer subtype for more precise matching (e.g. PropertyType='Residential', SubType='Townhouse')
  const candidates = [propertySubType, propertyType]
    .filter(Boolean)
    .map((v) => v!.toLowerCase().trim());

  for (const candidate of candidates) {
    for (const { patterns, normalized } of PROPERTY_TYPE_MAP) {
      if (patterns.some((p) => candidate.includes(p))) {
        return normalized;
      }
    }
  }

  return 'Other';
}

// -----------------------------------------------------------------------------
// MLS Status
// -----------------------------------------------------------------------------

const STATUS_MAP: Record<string, MlsStatus> = {
  'active':                'Active',
  'active under contract': 'Active Under Contract',
  'coming soon':           'Coming Soon',
  'pending':               'Pending',
  'closed':                'Sold',
  'sold':                  'Sold',
  'expired':               'Expired',
  'withdrawn':             'Withdrawn',
  'cancelled':             'Withdrawn',
  'canceled':              'Withdrawn',
  'delete':                'Withdrawn',
};

export function normalizeMlsStatus(value?: string): MlsStatus {
  if (!value) return 'Active';
  return STATUS_MAP[value.toLowerCase().trim()] ?? 'Active';
}

// -----------------------------------------------------------------------------
// Lot unit
// -----------------------------------------------------------------------------

function normalizeLotUnit(value?: string): LotUnit {
  if (!value) return 'sqft';
  const lower = value.toLowerCase().trim();
  if (lower.includes('acre')) return 'acres';
  return 'sqft';
}

// -----------------------------------------------------------------------------
// Photos
// -----------------------------------------------------------------------------

const PHOTO_CATEGORIES = ['photo', 'image', 'photograph', ''];

function normalizePhotos(media?: RESOMedia[]): ListingPhoto[] {
  if (!media || media.length === 0) return [];

  return media
    .filter((m) => {
      const cat = (m.MediaCategory ?? '').toLowerCase();
      return PHOTO_CATEGORIES.some((c) => cat.includes(c));
    })
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => ({
      url:     m.MediaURL,
      order:   m.Order ?? 0,
      caption: m.ShortDescription?.trim() || null,
    }));
}

// -----------------------------------------------------------------------------
// Features
// -----------------------------------------------------------------------------

function normalizeFeatures(raw: RESOListing): ListingFeatures {
  return {
    garage:             raw.AttachedGarageYN === true || (raw.GarageSpaces ?? 0) > 0,
    pool:               raw.PoolPrivateYN === true,
    waterfront:         raw.WaterfrontYN === true,
    new_construction:   raw.NewConstructionYN === true,
    garage_spaces:      raw.GarageSpaces ?? null,
    heating:            normalizeArray(raw.Heating),
    cooling:            normalizeArray(raw.Cooling),
    flooring:           normalizeArray(raw.Flooring),
    appliances:         normalizeArray(raw.Appliances),
    interior_features:  normalizeArray(raw.InteriorFeatures),
    exterior_features:  normalizeArray(raw.ExteriorFeatures),
    architectural_style: normalizeArray(raw.ArchitecturalStyle),
  };
}

function normalizeArray(value?: string | string[]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  // Some MLSs return comma-separated strings instead of arrays
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

// -----------------------------------------------------------------------------
// Text cleanup
// -----------------------------------------------------------------------------

function cleanText(value?: string): string | null {
  if (!value) return null;
  return value
    .replace(/<[^>]*>/g, ' ')      // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim() || null;
}
