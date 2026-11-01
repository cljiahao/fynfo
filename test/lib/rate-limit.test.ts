import { clientRateKey } from '@/lib/rate-limit';
import { describe, expect, it } from 'vitest';

const keyFor = (headers: Record<string, string>) =>
  clientRateKey(new Request('http://localhost/api/track', { headers }));

describe('clientRateKey', () => {
  it('prefers x-vercel-forwarded-for over x-real-ip and x-forwarded-for', () => {
    const all = keyFor({
      'x-vercel-forwarded-for': '203.0.113.1',
      'x-real-ip': '198.51.100.2',
      'x-forwarded-for': '192.0.2.3',
    });
    expect(all).toBe(keyFor({ 'x-vercel-forwarded-for': '203.0.113.1' }));
  });

  it('prefers x-real-ip over x-forwarded-for', () => {
    expect(
      keyFor({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '192.0.2.3' })
    ).toBe(keyFor({ 'x-real-ip': '198.51.100.2' }));
  });

  it('falls back to the first x-forwarded-for hop, then a shared bucket', () => {
    expect(keyFor({ 'x-forwarded-for': '192.0.2.3, 10.0.0.1' })).toBe(
      keyFor({ 'x-forwarded-for': '192.0.2.3' })
    );
    expect(keyFor({})).toMatch(/^[0-9a-f]{32}$/);
  });

  it('never exposes the raw address', () => {
    expect(keyFor({ 'x-real-ip': '198.51.100.2' })).not.toContain('198');
  });
});
