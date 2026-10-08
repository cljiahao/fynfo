import { DecryptionError } from '@/lib/crypto';
import {
  deriveInviteKey,
  generateInviteSecret,
  generateKh,
  hashInviteCode,
  unwrapKh,
  wrapKh,
} from '@/lib/household-key';
import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';

const MEMBER_DEK = Buffer.alloc(32, 7);
const OTHER_DEK = Buffer.alloc(32, 9);

describe('household-key — generateKh', () => {
  it('returns a 32-byte key', () => {
    expect(generateKh()).toHaveLength(32);
  });

  it('returns a different key each call', () => {
    expect(generateKh().equals(generateKh())).toBe(false);
  });
});

describe('household-key — wrap/unwrap round-trip', () => {
  it('recovers the original K_h with the correct key', () => {
    const kh = generateKh();
    const wrapped = wrapKh(kh, MEMBER_DEK);
    expect(wrapped).not.toContain(kh.toString('base64'));
    expect(unwrapKh(wrapped, MEMBER_DEK).equals(kh)).toBe(true);
  });

  it('throws DecryptionError when unwrapped with the wrong key', () => {
    const wrapped = wrapKh(generateKh(), MEMBER_DEK);
    expect(() => unwrapKh(wrapped, OTHER_DEK)).toThrow(DecryptionError);
  });

  it('throws DecryptionError on a tampered blob', () => {
    const wrapped = wrapKh(generateKh(), MEMBER_DEK);
    const decoded = JSON.parse(Buffer.from(wrapped, 'base64').toString('utf8'));
    const tag = Buffer.from(decoded.tag, 'base64');
    tag[0] ^= 0xff;
    decoded.tag = tag.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    expect(() => unwrapKh(tampered, MEMBER_DEK)).toThrow(DecryptionError);
  });
});

describe('household-key — invite secret + derivation', () => {
  it('generateInviteSecret returns a url-safe secret and a base64 salt', async () => {
    const { secret, saltB64 } = generateInviteSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(saltB64, 'base64')).toHaveLength(16);
  });

  it('generateInviteSecret is unique per call', () => {
    expect(generateInviteSecret().secret).not.toBe(
      generateInviteSecret().secret
    );
  });

  it('deriveInviteKey is deterministic for the same secret + salt', async () => {
    const { secret, saltB64 } = generateInviteSecret();
    expect(
      (await deriveInviteKey(secret, saltB64)).equals(
        await deriveInviteKey(secret, saltB64)
      )
    ).toBe(true);
  });

  it('deriveInviteKey differs across salts for the same secret', async () => {
    const { secret } = generateInviteSecret();
    const a = await deriveInviteKey(secret, generateInviteSecret().saltB64);
    const b = await deriveInviteKey(secret, generateInviteSecret().saltB64);
    expect(a.equals(b)).toBe(false);
  });

  it('the invite path round-trips K_h (derive -> wrap -> derive -> unwrap)', async () => {
    const kh = generateKh();
    const { secret, saltB64 } = generateInviteSecret();
    const inviteKey = await deriveInviteKey(secret, saltB64);
    const wrapped = wrapKh(kh, inviteKey);
    // Accepter re-derives from the same secret + salt and recovers K_h.
    const recovered = unwrapKh(wrapped, await deriveInviteKey(secret, saltB64));
    expect(recovered.equals(kh)).toBe(true);
  });

  it('hashInviteCode is a stable 64-char hex digest', () => {
    const { secret } = generateInviteSecret();
    expect(hashInviteCode(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteCode(secret)).toBe(hashInviteCode(secret));
  });
});

describe('asynchronous invite derivation compatibility', () => {
  it('rejects when the key derivation provider reports a failure', async () => {
    const providerError = new Error('fixture PBKDF2 provider failure');
    const spy = vi
      .spyOn(crypto, 'pbkdf2')
      .mockImplementation(
        (_password, _salt, _iterations, _keylen, _digest, callback) => {
          callback(providerError, Buffer.alloc(0));
        }
      );
    try {
      await expect(
        deriveInviteKey('fixture-secret', 'AAECAwQFBgcICQoLDA0ODw==')
      ).rejects.toBe(providerError);
    } finally {
      spy.mockRestore();
    }
  });

  it('returns a promise without blocking scheduled event-loop work and preserves fixture bytes', async () => {
    let loopRan = false;
    const scheduled = new Promise<void>((resolve) =>
      setImmediate(() => {
        loopRan = true;
        resolve();
      })
    );
    const result = deriveInviteKey(
      'audit-invite-fixture',
      'AAECAwQFBgcICQoLDA0ODw=='
    );
    expect(result).toBeInstanceOf(Promise);
    let derivationSettled = false;
    void result.then(() => {
      derivationSettled = true;
    });
    await scheduled;
    expect(derivationSettled).toBe(false);
    expect(loopRan).toBe(true);
    expect((await result).toString('hex')).toBe(
      'ae89c6be9426fd81662901f0f92f276f4a47a1805265e2423904750e3eda1d61'
    );
  });
});
