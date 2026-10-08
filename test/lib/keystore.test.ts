import { sealCookie } from '@/lib/cookie-seal';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);
const USER = 'fixture-user-a';

interface CookieJar {
  get: (name: string) => { value: string } | undefined;
}

let cookieJar: CookieJar;

vi.mock('next/headers', () => ({
  cookies: async () => cookieJar,
}));

describe('keystore — getVaultDekSession', () => {
  beforeEach(() => {
    cookieJar = { get: () => undefined };
  });

  it('returns null when no vault cookie is present', async () => {
    const { getVaultDekSession } = await import('@/lib/keystore');
    expect(await getVaultDekSession(USER)).toBeNull();
  });

  it('returns the original DEK for a validly sealed cookie', async () => {
    const dek = Buffer.alloc(32, 5);
    const blob = sealCookie(dek.toString('base64'), USER, 'vault-dek');
    cookieJar = {
      get: (n) => (n === 'fynfo_vault_dek' ? { value: blob } : undefined),
    };

    const { getVaultDekSession } = await import('@/lib/keystore');
    const result = await getVaultDekSession(USER);
    expect(result).not.toBeNull();
    expect((result as Buffer).equals(dek)).toBe(true);
    const record = encryptPayload('{"salary":1234}', dek);
    expect(decryptPayload(record, result!)).toBe('{"salary":1234}');
    expect(await getVaultDekSession('fixture-user-b')).toBeNull();
  });

  it('returns null for a tampered cookie blob', async () => {
    const dek = Buffer.alloc(32, 5);
    const blob = sealCookie(dek.toString('base64'), USER, 'vault-dek');
    const decoded = JSON.parse(Buffer.from(blob, 'base64').toString('utf8'));
    const tagBuf = Buffer.from(decoded.tag, 'base64');
    tagBuf[0] ^= 0xff;
    decoded.tag = tagBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    cookieJar = {
      get: (n) => (n === 'fynfo_vault_dek' ? { value: tampered } : undefined),
    };

    const { getVaultDekSession } = await import('@/lib/keystore');
    expect(await getVaultDekSession(USER)).toBeNull();
  });
});
