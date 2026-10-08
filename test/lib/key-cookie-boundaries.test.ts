import { openCookie, sealCookie } from '@/lib/cookie-seal';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'fixture-session-secret-071';
const KEY = Buffer.alloc(32, 7).toString('base64');
const USER = 'fixture-user-a';
const NOW = 1791432000;
const GOOD = {
  version: 1,
  userId: USER,
  purpose: 'vault-dek',
  key: KEY,
  issuedAt: NOW,
  expiresAt: NOW + 21600,
};
const jar = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => jar }));

// Independent fixture encoder can authenticate malformed plaintext that the
// production setter must never emit, exercising post-decryption validation.
function fixtureSeal(plaintext: string): string {
  const iv = Buffer.alloc(12, 9);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(SECRET).digest(),
    iv
  );
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString('base64'),
      data: data.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    })
  ).toString('base64');
}
beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('key-cookie identity, purpose, and server lifetime boundaries', () => {
  it('returns only a correct authenticated user/purpose key', () => {
    expect(
      openCookie(fixtureSeal(JSON.stringify(GOOD)), USER, 'vault-dek')
    ).toBe(KEY);
  });
  it('rejects replay under another identity', () => {
    const blob = sealCookie(KEY, USER, 'vault-dek');
    expect(() => openCookie(blob, 'fixture-user-b', 'vault-dek')).toThrow();
  });
  it('rejects personal/household purpose substitution in both directions', () => {
    expect(() =>
      openCookie(sealCookie(KEY, USER, 'vault-dek'), USER, 'household-kh')
    ).toThrow();
    expect(() =>
      openCookie(sealCookie(KEY, USER, 'household-kh'), USER, 'vault-dek')
    ).toThrow();
  });
  it('enforces the six-hour server expiration even if a browser replays the cookie', () => {
    const blob = sealCookie(KEY, USER, 'vault-dek');
    vi.setSystemTime((NOW + 21599) * 1000);
    expect(openCookie(blob, USER, 'vault-dek')).toBe(KEY);
    vi.setSystemTime((NOW + 21600) * 1000);
    expect(() => openCookie(blob, USER, 'vault-dek')).toThrow();
  });
  it.each([
    ['legacy key plaintext', KEY],
    ['non-JSON plaintext', 'invalid'],
    ['null inner envelope', 'null'],
    ['wrong version', JSON.stringify({ ...GOOD, version: 2 })],
    ['missing identity', JSON.stringify({ ...GOOD, userId: undefined })],
    ['empty identity', JSON.stringify({ ...GOOD, userId: '' })],
    ['wrong purpose', JSON.stringify({ ...GOOD, purpose: 'other' })],
    [
      'future issuance',
      JSON.stringify({ ...GOOD, issuedAt: NOW + 1, expiresAt: NOW + 21601 }),
    ],
    [
      'expired',
      JSON.stringify({ ...GOOD, issuedAt: NOW - 21600, expiresAt: NOW }),
    ],
    ['reversed time', JSON.stringify({ ...GOOD, expiresAt: NOW - 1 })],
    ['extended lifetime', JSON.stringify({ ...GOOD, expiresAt: NOW + 21601 })],
    ['fractional timestamp', JSON.stringify({ ...GOOD, issuedAt: NOW + 0.5 })],
    ['negative timestamp', JSON.stringify({ ...GOOD, issuedAt: -1 })],
    [
      'short key',
      JSON.stringify({ ...GOOD, key: Buffer.alloc(31).toString('base64') }),
    ],
    [
      'long key',
      JSON.stringify({ ...GOOD, key: Buffer.alloc(33).toString('base64') }),
    ],
    [
      'noncanonical key',
      JSON.stringify({ ...GOOD, key: KEY.replace(/=$/, '') }),
    ],
    ['extra field', JSON.stringify({ ...GOOD, extra: true })],
  ])('rejects authenticated %s', (_name, plaintext) => {
    expect(() =>
      openCookie(fixtureSeal(plaintext), USER, 'vault-dek')
    ).toThrow();
  });
  it.each([
    '',
    '%%%',
    Buffer.alloc(31).toString('base64'),
    KEY.replace(/=$/, ''),
  ])('does not seal invalid key material %s', (key) => {
    expect(() => sealCookie(key, USER, 'vault-dek')).toThrow();
  });
  it('requires an identity for seal and open', () => {
    expect(() => sealCookie(KEY, '', 'vault-dek')).toThrow();
    expect(() =>
      openCookie(fixtureSeal(JSON.stringify(GOOD)), '', 'vault-dek')
    ).toThrow();
  });
  it.each([
    '%%%',
    '',
    'A'.repeat(4097),
    Buffer.from('null').toString('base64'),
    Buffer.from(JSON.stringify({ iv: 7, data: 'abc', tag: null })).toString(
      'base64'
    ),
  ])('rejects malformed outer data', (blob) => {
    expect(() => openCookie(blob, USER, 'vault-dek')).toThrow();
  });
  it('rejects noncanonical outer base64 and nested encodings', () => {
    const blob = fixtureSeal(JSON.stringify(GOOD));
    expect(() => openCookie(`${blob}\n`, USER, 'vault-dek')).toThrow();
    const payload = JSON.parse(
      Buffer.from(blob, 'base64').toString('utf8')
    ) as { iv: string; data: string; tag: string };
    payload.iv += '\n';
    expect(() =>
      openCookie(
        Buffer.from(JSON.stringify(payload)).toString('base64'),
        USER,
        'vault-dek'
      )
    ).toThrow();
  });
  it.each(['vault-dek', 'household-kh'] as const)(
    'fails closed in the %s getter on replay, legacy, expired or wrong-purpose cookies',
    async (purpose) => {
      const { getVaultDekSession } = await import('@/lib/keystore');
      const { getHouseholdKhSession } =
        await import('@/lib/household-keystore');
      const read =
        purpose === 'vault-dek' ? getVaultDekSession : getHouseholdKhSession;
      const other = purpose === 'vault-dek' ? 'household-kh' : 'vault-dek';
      for (const blob of [
        sealCookie(KEY, 'fixture-user-b', purpose),
        sealCookie(KEY, USER, other),
        fixtureSeal(KEY),
        fixtureSeal(
          JSON.stringify({
            ...GOOD,
            purpose,
            issuedAt: NOW - 21600,
            expiresAt: NOW,
          })
        ),
        fixtureSeal(
          JSON.stringify({
            ...GOOD,
            purpose,
            key: Buffer.alloc(31).toString('base64'),
          })
        ),
      ]) {
        jar.get.mockReturnValue({ value: blob });
        expect(await read(USER)).toBeNull();
      }
      jar.get.mockReturnValue({ value: sealCookie(KEY, USER, purpose) });
      expect(await read(USER)).toEqual(Buffer.alloc(32, 7));
    }
  );
});
