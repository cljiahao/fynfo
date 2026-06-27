import { deriveKeyClient, deriveKeyLegacy } from '@/lib/client-crypto';
import { KEY_LEN_BYTES, V2_ITERATIONS } from '@/lib/crypto-constants';
import { pbkdf2Sync } from 'crypto';
import { describe, expect, it } from 'vitest';

const PIN = '123456';
const USER_ID = 'user-uuid-1111';
const V1_SALT = 'fynfo_v1_salt';

// Canonical PBKDF2 oracle using node's crypto — the WebCrypto derivation in
// client-crypto must match this byte-for-byte.
function refKey(pin: string, salt: string): string {
  return pbkdf2Sync(pin, salt, V2_ITERATIONS, KEY_LEN_BYTES, 'sha256').toString(
    'base64'
  );
}

describe('client-crypto — deriveKeyClient (v2 per-user salt)', () => {
  it('matches canonical PBKDF2 with the shared constants (lock-step)', async () => {
    expect(await deriveKeyClient(PIN, USER_ID)).toBe(refKey(PIN, USER_ID));
  });

  it('is deterministic for the same pin + userId', async () => {
    expect(await deriveKeyClient(PIN, USER_ID)).toBe(
      await deriveKeyClient(PIN, USER_ID)
    );
  });

  it('changes when the userId (salt) changes', async () => {
    expect(await deriveKeyClient(PIN, USER_ID)).not.toBe(
      await deriveKeyClient(PIN, 'a-different-user')
    );
  });

  it('changes when the pin changes', async () => {
    expect(await deriveKeyClient(PIN, USER_ID)).not.toBe(
      await deriveKeyClient('654321', USER_ID)
    );
  });

  it('derives a 32-byte key', async () => {
    const key = await deriveKeyClient(PIN, USER_ID);
    expect(Buffer.from(key, 'base64')).toHaveLength(KEY_LEN_BYTES);
  });
});

describe('client-crypto — deriveKeyLegacy (v1 static salt)', () => {
  it('matches canonical PBKDF2 with the static v1 salt', async () => {
    expect(await deriveKeyLegacy(PIN)).toBe(refKey(PIN, V1_SALT));
  });

  it('differs from the v2 per-user derivation for the same pin', async () => {
    expect(await deriveKeyLegacy(PIN)).not.toBe(
      await deriveKeyClient(PIN, USER_ID)
    );
  });
});
