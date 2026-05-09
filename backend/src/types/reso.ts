/**
 * RESO Web API 2.0 field types
 * Reference: https://ddwiki.reso.org/display/DDW17/RESO+Data+Dictionary+1.7
 *
 * These match the field names returned by Bridge Interactive (and Spark API).
 * Not every field will be populated — depends on the MLS's data dictionary.
 */

export interface RESOMedia {
  MediaKey: string;
  MediaURL: string;
  Order: number;
  MediaCategory: string; // 'Photo', 'FloorPlan', 'Video', etc.
  ShortDescription?: string;
  ModificationTimestamp?: string;
}

export interface RESOListing {
  // ---- Identifiers ----
  ListingKey: string;           // Primary key within the MLS
  ListingId: string;            // Human-readable MLS number
  OriginatingSystemName: string; // 'CMLS', 'FMLS', 'Stellar', etc.
  OriginatingSystemKey?: string;

  // ---- Address ----
  StreetNumberNumeric?: number;
  StreetNumber?: string;
  StreetDirPrefix?: string;
  StreetName?: string;
  StreetSuffix?: string;
  StreetDirSuffix?: string;
  UnitNumber?: string;
  City: string;
  CountyOrParish?: string;
  StateOrProvince: string;      // 'SC', 'GA', 'FL'
  PostalCode: string;
  Country?: string;

  // ---- Geo ----
  Latitude?: number;
  Longitude?: number;

  // ---- Price ----
  ListPrice?: number;
  OriginalListPrice?: number;
  ClosePrice?: number;

  // ---- Property details ----
  BedroomsTotal?: number;
  BathroomsTotalDecimal?: number;
  BathroomsTotalInteger?: number;
  BathroomsFull?: number;
  BathroomsHalf?: number;
  LivingArea?: number;          // sqft
  LivingAreaUnits?: string;     // 'Square Feet'
  LotSizeArea?: number;
  LotSizeUnits?: string;        // 'Square Feet' | 'Acres'
  LotSizeDimensions?: string;
  YearBuilt?: number;
  AboveGradeFinishedArea?: number;
  BelowGradeFinishedArea?: number;
  GarageSpaces?: number;
  AttachedGarageYN?: boolean;
  PoolPrivateYN?: boolean;
  WaterfrontYN?: boolean;
  WaterfrontFeatures?: string[];
  Heating?: string[];
  Cooling?: string[];
  Flooring?: string[];
  Appliances?: string[];
  InteriorFeatures?: string[];
  ExteriorFeatures?: string[];
  ArchitecturalStyle?: string[];
  ConstructionMaterials?: string[];
  NewConstructionYN?: boolean;

  // ---- Classification ----
  PropertyType?: string;
  // 'Residential' | 'Condominium' | 'Land' | 'Multi Family' | 'Commercial' | etc.
  PropertySubType?: string;
  // 'Single Family Residence' | 'Townhouse' | 'Condominium' | etc.

  // ---- MLS status ----
  StandardStatus?: string;
  // 'Active' | 'Active Under Contract' | 'Pending' | 'Closed' | 'Expired' | 'Withdrawn' | 'Coming Soon'
  MlsStatus?: string;           // MLS-specific status (less standardized)

  // ---- Content ----
  PublicRemarks?: string;
  PrivateRemarks?: string;      // Never expose publicly
  Media?: RESOMedia[];

  // ---- Listing agent & office (IDX attribution — required) ----
  ListAgentFullName?: string;
  ListAgentMlsId?: string;
  ListAgentEmail?: string;
  ListAgentDirectPhone?: string;
  ListOfficeName?: string;
  ListOfficeMlsId?: string;

  // ---- Timestamps ----
  ListingContractDate?: string;       // ISO date string
  OnMarketDate?: string;
  CloseDate?: string;
  PriceChangeTimestamp?: string;      // ISO datetime string
  ModificationTimestamp: string;      // ISO datetime — used for incremental sync filter
  OriginalEntryTimestamp?: string;
}

/**
 * Paginated response from the RESO Web API (OData format)
 */
export interface RESOResponse {
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: RESOListing[];
}
