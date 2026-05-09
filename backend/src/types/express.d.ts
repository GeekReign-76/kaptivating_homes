/**
 * express.d.ts
 *
 * Augments Express Request with the authenticated user payload
 * populated by the auth middleware after Supabase JWT verification.
 */

declare namespace Express {
  interface Request {
    user?: {
      id:    string;
      email: string;
      role:  'agent' | 'client';
    };
  }
}
