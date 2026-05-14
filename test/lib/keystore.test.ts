import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SESSION_SECRET = 'x'.repeat(32);

interface CookieJar {
  get: (name: string) => { value: string } | undefined;
}

let cookieJar: CookieJar;

vi.mock('next/headers', () => ({
  cookies: async () => cookieJar,
}));

// Replicates the route's encryptCookiePayload (SHA256(SESSION_SECRET) GCM envelope)
// so we can seal a valid fynfo_vault_dek cookie without importing the route.
function sealCookie(plaintext: string): string {
  const aesKey = crypto
    .createHash('sha256')
    .update(process.env.SESSION_SECRET as string)
    .digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  let data = cipher.update(plaintext, 'utf8', 'base64');
  data += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  const payload = JSON.stringify({ iv: iv.toString('base64'), data, tag });
  return Buffer.from(payload).toString('base64');
}

describe('keystore — getVaultDekSession', () => {
  beforeEach(() => {
    cookieJar = { get: () => undefined };
  });

  it('returns null when no vault cookie is present', async () => {
    const { getVaultDekSession } = await import('@/lib/keystore');
    expect(await getVaultDekSession()).toBeNull();
  });

  it('returns the original DEK for a validly sealed cookie', async () => {
    const dek = Buffer.alloc(32, 5);
    const blob = sealCookie(dek.toString('base64'));
    cookieJar = {
      get: (n) => (n === 'fynfo_vault_dek' ? { value: blob } : undefined),
    };

    const { getVaultDekSession } = await import('@/lib/keystore');
    const result = await getVaultDekSession();
    expect(result).not.toBeNull();
    expect((result as Buffer).equals(dek)).toBe(true);
  });

  it('returns null for a tampered cookie blob', async () => {
    const dek = Buffer.alloc(32, 5);
    const blob = sealCookie(dek.toString('base64'));
    const decoded = JSON.parse(Buffer.from(blob, 'base64').toString('utf8'));
    const tagBuf = Buffer.from(decoded.tag, 'base64');
    tagBuf[0] ^= 0xff;
    decoded.tag = tagBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    cookieJar = {
      get: (n) => (n === 'fynfo_vault_dek' ? { value: tampered } : undefined),
    };

    const { getVaultDekSession } = await import('@/lib/keystore');
    expect(await getVaultDekSession()).toBeNull();
  });
});
