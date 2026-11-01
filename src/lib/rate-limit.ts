import 'server-only';

import crypto from 'crypto';

// Hashed so the telemetry limiter never stores a raw address. Vercel
// overwrites x-forwarded-for, so its first hop is the client.
export function clientRateKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}
