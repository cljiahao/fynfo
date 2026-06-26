import { DecryptionError } from '@/lib/crypto';
import {
  deriveInviteKey,
  generateInviteSecret,
  generateKh,
  hashInviteCode,
  unwrapKh,
  wrapKh,
} from '@/lib/household-key';
import { describe, expect, it } from 'vitest';

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
    expect(wrapped).not.toContain(kh.toString('base64')); // ciphertext, not plaintext
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
  it('generateInviteSecret returns a url-safe secret and a base64 salt', () => {
    const { secret, saltB64 } = generateInviteSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding chars
    expect(Buffer.from(saltB64, 'base64')).toHaveLength(16);
  });

  it('generateInviteSecret is unique per call', () => {
    expect(generateInviteSecret().secret).not.toBe(
      generateInviteSecret().secret
    );
  });

  it('deriveInviteKey is deterministic for the same secret + salt', () => {
    const { secret, saltB64 } = generateInviteSecret();
    expect(
      deriveInviteKey(secret, saltB64).equals(deriveInviteKey(secret, saltB64))
    ).toBe(true);
  });

  it('deriveInviteKey differs across salts for the same secret', () => {
    const { secret } = generateInviteSecret();
    const a = deriveInviteKey(secret, generateInviteSecret().saltB64);
    const b = deriveInviteKey(secret, generateInviteSecret().saltB64);
    expect(a.equals(b)).toBe(false);
  });

  it('the invite path round-trips K_h (derive -> wrap -> derive -> unwrap)', () => {
    const kh = generateKh();
    const { secret, saltB64 } = generateInviteSecret();
    const inviteKey = deriveInviteKey(secret, saltB64);
    const wrapped = wrapKh(kh, inviteKey);
    // Accepter re-derives from the same secret + salt and recovers K_h.
    const recovered = unwrapKh(wrapped, deriveInviteKey(secret, saltB64));
    expect(recovered.equals(kh)).toBe(true);
  });

  it('hashInviteCode is a stable 64-char hex digest', () => {
    const { secret } = generateInviteSecret();
    expect(hashInviteCode(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteCode(secret)).toBe(hashInviteCode(secret));
  });
});
