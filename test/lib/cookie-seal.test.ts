import { getSessionSecret, openCookie, sealCookie } from '@/lib/cookie-seal';
import { afterEach, describe, expect, it } from 'vitest';

const SECRET = 'x'.repeat(32);

afterEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe('cookie-seal', () => {
  it('round-trips a plaintext through seal/open', () => {
    process.env.SESSION_SECRET = SECRET;
    const dekB64 = Buffer.alloc(32, 5).toString('base64');
    expect(openCookie(sealCookie(dekB64))).toBe(dekB64);
  });

  it('throws when the ciphertext is tampered', () => {
    process.env.SESSION_SECRET = SECRET;
    const blob = sealCookie('secret');
    const decoded = JSON.parse(Buffer.from(blob, 'base64').toString('utf8'));
    const dataBuf = Buffer.from(decoded.data, 'base64');
    dataBuf[0] ^= 0xff;
    decoded.data = dataBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    expect(() => openCookie(tampered)).toThrow();
  });

  it('throws for a bad iv/tag length envelope', () => {
    process.env.SESSION_SECRET = SECRET;
    const bad = Buffer.from(
      JSON.stringify({
        iv: Buffer.alloc(4).toString('base64'),
        data: 'AAAA',
        tag: Buffer.alloc(16).toString('base64'),
      })
    ).toString('base64');
    expect(() => openCookie(bad)).toThrow('invalid cookie envelope');
  });

  it('throws when opened with a different secret than it was sealed with', () => {
    process.env.SESSION_SECRET = SECRET;
    const blob = sealCookie('secret');
    process.env.SESSION_SECRET = 'y'.repeat(32);
    expect(() => openCookie(blob)).toThrow();
  });

  it('getSessionSecret throws when SESSION_SECRET is unset', () => {
    delete process.env.SESSION_SECRET;
    expect(() => getSessionSecret()).toThrow('SESSION_SECRET');
  });
});
