/**
 * auth.ts
 *
 * Express middleware that validates a Supabase JWT from the
 * Authorization header and attaches the decoded user to req.user.
 *
 * Usage:
 *   import { authMiddleware } from '../middleware/auth';
 *   router.get('/protected', authMiddleware, handler);
 *
 * Routes that need to be PUBLIC (no auth) simply omit the middleware.
 * Routes that need to be agent-only add their own requireAgent() guard
 * on top of this middleware (see routes/chat.ts for the pattern).
 */

import { Request, Response, NextFunction } from 'express';
import { createClient }                    from '@supabase/supabase-js';
import ws                                  from 'ws';

// Use the anon key here — we only need to verify the JWT, not bypass RLS
const supabaseAuth = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { realtime: { transport: ws as any } },
);

export async function authMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      data:  null,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({
      data:  null,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  // Attach to request — role is stored in user_metadata at sign-up
  req.user = {
    id:    user.id,
    email: user.email ?? '',
    role:  (user.user_metadata?.role as 'agent' | 'client') ?? 'client',
  };

  next();
}

/**
 * Lightweight guard to call AFTER authMiddleware when the endpoint
 * is agent-only.  Most routes import this from their own route file
 * as a local function; this export is provided for shared use.
 */
export function requireAgent(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'agent') {
    res.status(403).json({
      data:  null,
      error: { code: 'UNAUTHORIZED', message: 'Agent access required' },
    });
    return;
  }
  next();
}
