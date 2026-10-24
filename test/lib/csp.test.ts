import { buildCsp, generateNonce } from '@/lib/csp';
import { describe, expect, it } from 'vitest';

describe('buildCsp', () => {
  const csp = buildCsp('abc', 'https://proj.supabase.co/', false);

  it('pins scripts to the nonce and forbids eval in production', () => {
    expect(csp).toContain(
      "script-src 'self' 'nonce-abc' 'strict-dynamic' 'wasm-unsafe-eval'"
    );
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('limits connections to self and the Supabase origin', () => {
    expect(csp).toContain("connect-src 'self' https://proj.supabase.co");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allows eval and websockets only in development', () => {
    const dev = buildCsp('abc', 'http://127.0.0.1:54321', true);
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain('ws:');
  });

  it('generates a distinct nonce per call', () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});
