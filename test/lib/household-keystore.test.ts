import { sealCookie } from '@/lib/cookie-seal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);

interface CookieJar {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, opts: unknown) => void;
}

let cookieJar: CookieJar;
let setCalls: Array<{ name: string; value: string; opts: unknown }>;

vi.mock('next/headers', () => ({
  cookies: async () => cookieJar,
}));

beforeEach(() => {
  setCalls = [];
  cookieJar = {
    get: () => undefined,
    set: (name, value, opts) => setCalls.push({ name, value, opts }),
  };
});

describe('household-keystore — getHouseholdKhSession', () => {
  it('returns null when no household cookie is present', async () => {
    const { getHouseholdKhSession } = await import('@/lib/household-keystore');
    expect(await getHouseholdKhSession()).toBeNull();
  });

  it('returns the original K_h for a validly sealed cookie', async () => {
    const kh = Buffer.alloc(32, 3);
    const blob = sealCookie(kh.toString('base64'));
    cookieJar.get = (n) =>
      n === 'fynfo_household_kh' ? { value: blob } : undefined;

    const { getHouseholdKhSession } = await import('@/lib/household-keystore');
    const result = await getHouseholdKhSession();
    expect(result).not.toBeNull();
    expect((result as Buffer).equals(kh)).toBe(true);
  });

  it('returns null for a tampered cookie blob', async () => {
    const kh = Buffer.alloc(32, 3);
    const blob = sealCookie(kh.toString('base64'));
    const decoded = JSON.parse(Buffer.from(blob, 'base64').toString('utf8'));
    const tag = Buffer.from(decoded.tag, 'base64');
    tag[0] ^= 0xff;
    decoded.tag = tag.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    cookieJar.get = (n) =>
      n === 'fynfo_household_kh' ? { value: tampered } : undefined;

    const { getHouseholdKhSession } = await import('@/lib/household-keystore');
    expect(await getHouseholdKhSession()).toBeNull();
  });
});

describe('household-keystore — setHouseholdKhSession', () => {
  it('seals K_h under the household cookie name; round-trips via openCookie', async () => {
    const kh = Buffer.alloc(32, 8);
    const { setHouseholdKhSession, getHouseholdKhSession } =
      await import('@/lib/household-keystore');
    await setHouseholdKhSession(kh);

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].name).toBe('fynfo_household_kh');
    // the sealed value is not the raw key
    expect(setCalls[0].value).not.toContain(kh.toString('base64'));

    // feed the sealed value back through get to prove the round-trip
    cookieJar.get = (n) =>
      n === 'fynfo_household_kh' ? { value: setCalls[0].value } : undefined;
    const result = await getHouseholdKhSession();
    expect((result as Buffer).equals(kh)).toBe(true);
  });
});
