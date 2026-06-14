/**
 * analytics.ts
 *
 * Agent-only GA4 analytics proxy.
 * Fetches data from Google Analytics Data API v1 using a service account.
 *
 * Required env vars:
 *   GA4_PROPERTY_ID          — numeric GA4 property ID (e.g. "123456789")
 *                              Find it in GA4 → Admin → Property Settings
 *   GA4_SERVICE_ACCOUNT_JSON — full JSON string of the service account key file
 *                              Create at console.cloud.google.com → IAM → Service Accounts
 *                              Grant "Viewer" access to GA4 property under Property → Property Access Management
 *
 * If vars are missing, returns { configured: false } so the UI can show setup instructions.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAgent } from '../middleware/auth';

export const analyticsRouter = Router();

// All analytics endpoints require agent auth
analyticsRouter.use(authMiddleware, requireAgent);

// Simple in-memory cache keyed by period (days) to avoid hammering the GA4 API
const cache = new Map<number, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// -------------------------------------------------------------------------
// GET /api/v1/analytics/summary
// Returns aggregated GA4 metrics for the last N days (default 30)
// -------------------------------------------------------------------------

analyticsRouter.get('/summary', async (req: Request, res: Response) => {
  const propertyId        = process.env.GA4_PROPERTY_ID;
  const serviceAccountRaw = process.env.GA4_SERVICE_ACCOUNT_JSON;

  if (!propertyId || !serviceAccountRaw) {
    return res.json({
      data: { configured: false },
      error: null,
    });
  }

  try {
    const days   = Math.min(90, Math.max(1, parseInt(req.query.days as string || '30', 10)));
    const cached = cache.get(days);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ data: cached.data, error: null });
    }

    const serviceAccount = JSON.parse(serviceAccountRaw);
    const accessToken    = await getGoogleAccessToken(serviceAccount);
    const startDate      = `${days}daysAgo`;

    const [totalsResp, pagesResp, channelsResp, citiesResp] = await Promise.all([
      runGA4Report(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      }),
      runGA4Report(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        limit: 10,
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      }),
      runGA4Report(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        limit: 8,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
      runGA4Report(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'city' }, { name: 'region' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        limit: 15,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
    ]);

    const totalsRow = totalsResp.rows?.[0]?.metricValues ?? [];
    const totals = {
      sessions:           parseFloat(totalsRow[0]?.value ?? '0'),
      users:              parseFloat(totalsRow[1]?.value ?? '0'),
      pageviews:          parseFloat(totalsRow[2]?.value ?? '0'),
      bounceRate:         parseFloat(totalsRow[3]?.value ?? '0'),
      avgSessionDuration: parseFloat(totalsRow[4]?.value ?? '0'),
    };

    const topPages = (pagesResp.rows ?? []).map((row: any) => ({
      path:  row.dimensionValues?.[0]?.value ?? '/',
      views: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
    }));

    const channels = (channelsResp.rows ?? []).map((row: any) => ({
      channel:  row.dimensionValues?.[0]?.value ?? 'Unknown',
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
    }));

    const cities = (citiesResp.rows ?? [])
      .filter((row: any) => row.dimensionValues?.[0]?.value !== '(not set)')
      .map((row: any) => ({
        city:     row.dimensionValues?.[0]?.value ?? 'Unknown',
        region:   row.dimensionValues?.[1]?.value ?? '',
        sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
        users:    parseInt(row.metricValues?.[1]?.value ?? '0', 10),
      }));

    const result = {
      configured: true,
      period: `${days} days`,
      totals,
      topPages,
      channels,
      cities,
    };

    // Cache the result keyed by period
    cache.set(days, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return res.json({ data: result, error: null });
  } catch (err: any) {
    console.error('[analytics] GA4 error:', err.message);
    return res.status(500).json({
      data:  null,
      error: { code: 'GA4_ERROR', message: err.message },
    });
  }
});

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

async function runGA4Report(accessToken: string, propertyId: string, body: object): Promise<any> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API ${res.status}: ${text}`);
  }
  return res.json();
}

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  };

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claim)}`;

  // Import the service account private key
  const pemBody   = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/-----END PRIVATE KEY-----\n?/, '')
    .replace(/\n/g, '');
  const keyBuffer = Buffer.from(pemBody, 'base64');

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await globalThis.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(unsigned),
  );

  const jwt = `${unsigned}.${Buffer.from(sig).toString('base64url')}`;

  // Exchange JWT for an OAuth access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const tokenData: any = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`OAuth token error: ${tokenData.error_description ?? tokenData.error ?? 'unknown'}`);
  }
  return tokenData.access_token;
}
