import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let headerMap: Map<string, string>;

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
  }),
}));

import {
  getAppOrigin,
  isForwardedHostAllowed,
} from '@/lib/utils/request-origin';

describe('isForwardedHostAllowed', () => {
  it('returns false for an empty allow-list', () => {
    expect(isForwardedHostAllowed('app.fynfo.com', '')).toBe(false);
  });

  it("trusts any host when TRUST_PROXY is '1'", () => {
    expect(isForwardedHostAllowed('anything.evil.com', '1')).toBe(true);
  });

  it('matches a listed host case-insensitively, port included', () => {
    expect(
      isForwardedHostAllowed('App.Fynfo.com', 'alb.internal, app.fynfo.com')
    ).toBe(true);
    expect(isForwardedHostAllowed('app.fynfo.com:443', 'app.fynfo.com')).toBe(
      false
    );
  });

  it('rejects a host not in the list', () => {
    expect(isForwardedHostAllowed('evil.com', 'app.fynfo.com')).toBe(false);
  });
});

describe('getAppOrigin', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    headerMap = new Map();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.unstubAllEnvs();
  });

  it('honors a forwarded host that is in the allow-list', async () => {
    process.env.TRUST_PROXY = 'app.fynfo.com';
    headerMap.set('x-forwarded-proto', 'https');
    headerMap.set('x-forwarded-host', 'app.fynfo.com');
    headerMap.set('host', 'internal:3000');

    expect(await getAppOrigin()).toBe('https://app.fynfo.com');
  });

  it('ignores a spoofed forwarded host and falls back to the host header', async () => {
    process.env.TRUST_PROXY = 'app.fynfo.com';
    vi.stubEnv('NODE_ENV', 'production');
    headerMap.set('x-forwarded-proto', 'https');
    headerMap.set('x-forwarded-host', 'evil.com');
    headerMap.set('host', 'internal:3000');

    expect(await getAppOrigin()).toBe('https://internal:3000');
  });

  it("trusts any forwarded host when TRUST_PROXY='1'", async () => {
    process.env.TRUST_PROXY = '1';
    headerMap.set('x-forwarded-proto', 'https');
    headerMap.set('x-forwarded-host', 'whatever.com');

    expect(await getAppOrigin()).toBe('https://whatever.com');
  });

  it('ignores forwarded headers when TRUST_PROXY is empty', async () => {
    process.env.TRUST_PROXY = '';
    vi.stubEnv('NODE_ENV', 'production');
    headerMap.set('x-forwarded-proto', 'https');
    headerMap.set('x-forwarded-host', 'evil.com');
    headerMap.set('host', 'app.internal');

    expect(await getAppOrigin()).toBe('https://app.internal');
  });

  it('falls back to NEXT_PUBLIC_BASE_URL when no host header is present', async () => {
    process.env.TRUST_PROXY = '';
    process.env.NEXT_PUBLIC_BASE_URL = 'https://fynfo.example';

    expect(await getAppOrigin()).toBe('https://fynfo.example');
  });
});
