import { encryptPayload } from '@/lib/crypto';
import {
  decryptNumber,
  decryptOptionalNumber,
  decryptOptionalString,
} from '@/lib/crypto-fields';
import { describe, expect, it } from 'vitest';

const DEK = Buffer.alloc(32, 7);

describe('decryptNumber', () => {
  it('round-trips a numeric value', async () => {
    const cipher = await encryptPayload('42.5', DEK);
    expect(await decryptNumber(cipher, DEK)).toBe(42.5);
  });
});

describe('decryptOptionalString', () => {
  it('returns the decrypted value when present', async () => {
    const cipher = await encryptPayload('Savings', DEK);
    expect(await decryptOptionalString(cipher, DEK)).toBe('Savings');
  });

  it("returns '' for null / undefined / empty cipher", async () => {
    expect(await decryptOptionalString(null, DEK)).toBe('');
    expect(await decryptOptionalString(undefined, DEK)).toBe('');
    expect(await decryptOptionalString('', DEK)).toBe('');
  });
});

describe('decryptOptionalNumber', () => {
  it('returns the parsed number when present', async () => {
    const cipher = await encryptPayload('12', DEK);
    expect(await decryptOptionalNumber(cipher, DEK)).toBe(12);
  });

  it('returns the fallback (default 0) for an absent cipher', async () => {
    expect(await decryptOptionalNumber(null, DEK)).toBe(0);
    expect(await decryptOptionalNumber(undefined, DEK, 7)).toBe(7);
  });
});
