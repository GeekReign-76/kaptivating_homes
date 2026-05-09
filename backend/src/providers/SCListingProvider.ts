import { ListingProvider } from './ListingProvider';
import { RESOListing, RESOResponse } from '../types/reso';

/**
 * SCListingProvider
 *
 * Connects to SC/CMLS listings via Bridge Interactive's RESO Web API.
 * Bridge Interactive uses OAuth 2.0 Client Credentials for auth.
 *
 * Environment variables required:
 *   SC_IDX_CLIENT_ID       - Bridge Interactive OAuth client ID
 *   SC_IDX_CLIENT_SECRET   - Bridge Interactive OAuth client secret
 *   SC_IDX_MARKET_ID       - UUID of the SC row in the markets table
 *   SC_IDX_BASE_URL        - Bridge Interactive API base URL
 *                            e.g. https://api.bridgedataoutput.com/api/v2/OData/[dataset]
 *
 * Bridge Interactive RESO Web API docs:
 *   https://docs.bridgedataoutput.com/
 */
export class SCListingProvider implements ListingProvider {
  private readonly marketId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly mlsSource = 'CMLS';

  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.marketId     = this.requireEnv('SC_IDX_MARKET_ID');
    this.clientId     = this.requireEnv('SC_IDX_CLIENT_ID');
    this.clientSecret = this.requireEnv('SC_IDX_CLIENT_SECRET');
    this.baseUrl      = this.requireEnv('SC_IDX_BASE_URL');
  }

  getMarketId(): string {
    return this.marketId;
  }

  getMlsSource(): string {
    return this.mlsSource;
  }

  // -------------------------------------------------------------------------
  // fetchAll — yields all active listings in pages
  // -------------------------------------------------------------------------

  async *fetchAll(pageSize = 100): AsyncGenerator<RESOListing[]> {
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildUrl('/Property', {
        $filter: "StandardStatus eq 'Active'",
        $select: SELECTED_FIELDS,
        $expand: 'Media',
        $orderby: 'ListingKey asc',
        $top: String(pageSize),
        $skip: String(skip),
        $count: 'true',
      });

      const response = await this.get<RESOResponse>(url);

      if (response.value.length === 0) {
        hasMore = false;
        break;
      }

      yield response.value;

      skip += response.value.length;

      // If the response includes a nextLink, we have more pages.
      // If total count is known and we've fetched all, stop.
      if (!response['@odata.nextLink'] && response['@odata.count'] !== undefined) {
        hasMore = skip < response['@odata.count'];
      } else {
        hasMore = response.value.length === pageSize;
      }
    }
  }

  // -------------------------------------------------------------------------
  // fetchModifiedSince — yields only listings modified after `since`
  // -------------------------------------------------------------------------

  async *fetchModifiedSince(since: Date, pageSize = 100): AsyncGenerator<RESOListing[]> {
    const sinceIso = since.toISOString();
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildUrl('/Property', {
        $filter: `ModificationTimestamp gt ${sinceIso}`,
        $select: SELECTED_FIELDS,
        $expand: 'Media',
        $orderby: 'ModificationTimestamp asc',
        $top: String(pageSize),
        $skip: String(skip),
      });

      const response = await this.get<RESOResponse>(url);

      if (response.value.length === 0) break;

      yield response.value;

      skip += response.value.length;
      hasMore = response.value.length === pageSize;
    }
  }

  // -------------------------------------------------------------------------
  // fetchById — single listing lookup for stale check
  // -------------------------------------------------------------------------

  async fetchById(mlsId: string): Promise<RESOListing | null> {
    const url = this.buildUrl('/Property', {
      $filter: `ListingKey eq '${mlsId}'`,
      $select: SELECTED_FIELDS,
      $expand: 'Media',
      $top: '1',
    });

    const response = await this.get<RESOResponse>(url);
    return response.value[0] ?? null;
  }

  // -------------------------------------------------------------------------
  // testConnection
  // -------------------------------------------------------------------------

  async testConnection(): Promise<boolean> {
    try {
      const url = this.buildUrl('/Property', {
        $top: '1',
        $select: 'ListingKey',
      });
      await this.get<RESOResponse>(url);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Auth — OAuth 2.0 Client Credentials
  // -------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    const res = await fetch('https://auth.bridgedataoutput.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      throw new Error(`Bridge Interactive auth failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };

    this.accessToken = data.access_token;
    // Subtract 60s buffer to refresh before expiry
    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken;
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private async get<T>(url: string): Promise<T> {
    const token = await this.getAccessToken();

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 429) {
      // Rate limited — respect Retry-After header
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '30', 10);
      await sleep(retryAfter * 1000);
      return this.get<T>(url); // retry once
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bridge Interactive API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
  }
}

// -------------------------------------------------------------------------
// RESO fields to request from the API
// Requesting only what we need reduces payload size significantly
// -------------------------------------------------------------------------

const SELECTED_FIELDS = [
  'ListingKey',
  'ListingId',
  'OriginatingSystemName',
  'StreetNumber',
  'StreetName',
  'StreetSuffix',
  'UnitNumber',
  'City',
  'CountyOrParish',
  'StateOrProvince',
  'PostalCode',
  'Latitude',
  'Longitude',
  'ListPrice',
  'BedroomsTotal',
  'BathroomsTotalDecimal',
  'BathroomsHalf',
  'LivingArea',
  'LotSizeArea',
  'LotSizeUnits',
  'YearBuilt',
  'PropertyType',
  'PropertySubType',
  'StandardStatus',
  'PublicRemarks',
  'ListAgentFullName',
  'ListAgentMlsId',
  'ListOfficeName',
  'ListOfficeMlsId',
  'ListingContractDate',
  'PriceChangeTimestamp',
  'ModificationTimestamp',
  'OriginalEntryTimestamp',
  'GarageSpaces',
  'AttachedGarageYN',
  'PoolPrivateYN',
  'WaterfrontYN',
  'WaterfrontFeatures',
  'NewConstructionYN',
  'Heating',
  'Cooling',
  'Flooring',
  'Appliances',
  'InteriorFeatures',
  'ExteriorFeatures',
].join(',');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
