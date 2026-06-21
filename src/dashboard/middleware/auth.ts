import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '@/config/loader.js';

/** Constant-time string comparison that tolerates length mismatches. */
export function tokensMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  const headerToken = req.headers['x-auth-token'];
  if (typeof headerToken === 'string') return headerToken;
  const queryToken = req.query.token;
  if (typeof queryToken === 'string') return queryToken;
  return undefined;
}

/**
 * Gate the dashboard API behind `dashboard.authToken`. When no token is
 * configured (the default) every request passes through unchanged, preserving
 * the zero-config local experience.
 */
export function apiAuth(req: Request, res: Response, next: NextFunction): void {
  const required = config.dashboard.authToken;
  if (!required) {
    next();
    return;
  }
  if (tokensMatch(extractToken(req), required)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
