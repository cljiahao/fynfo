import 'server-only';

import crypto from 'crypto';

// Assumes Vercel overwrites these headers, so a client cannot spoof its bucket.
// The address is hashed so the limiter never stores a raw IP.
export function clientRateKey(req: Request): string {
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}
