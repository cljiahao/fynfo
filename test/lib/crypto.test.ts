import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { describe, expect, it } from 'vitest';

const DEK = Buffer.alloc(32, 7);

describe('crypto — AES-256-GCM payload envelope', () => {
  it('round-trips empty, unicode, and long strings', () => {
    for (const text of ['', 'hello', 'café — 日本語 — 🔐', 'x'.repeat(5000)]) {
      const sealed = encryptPayload(text, DEK);
      expect(decryptPayload(sealed, DEK)).toBe(text);
    }
  });

  it('produces a unique IV per call (no ciphertext reuse)', () => {
    const a = encryptPayload('same', DEK);
    const b = encryptPayload('same', DEK);
    expect(a).not.toBe(b);
  });

  it('throws DecryptionError for the wrong key', () => {
    const sealed = encryptPayload('secret', DEK);
    const wrong = Buffer.alloc(32, 9);
    expect(() => decryptPayload(sealed, wrong)).toThrow(DecryptionError);
  });

  it('throws DecryptionError when the ciphertext is tampered', () => {
    const sealed = encryptPayload('secret', DEK);
    const decoded = JSON.parse(Buffer.from(sealed, 'base64').toString('utf8'));
    const dataBuf = Buffer.from(decoded.data, 'base64');
    dataBuf[0] ^= 0xff;
    decoded.data = dataBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    expect(() => decryptPayload(tampered, DEK)).toThrow(DecryptionError);
  });

  it('throws DecryptionError when the auth tag is tampered', () => {
    const sealed = encryptPayload('secret', DEK);
    const decoded = JSON.parse(Buffer.from(sealed, 'base64').toString('utf8'));
    const tagBuf = Buffer.from(decoded.tag, 'base64');
    tagBuf[0] ^= 0xff;
    decoded.tag = tagBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');
    expect(() => decryptPayload(tampered, DEK)).toThrow(DecryptionError);
  });

  it('throws DecryptionError (not a raw error) for malformed input', () => {
    expect(() => decryptPayload('not-valid-base64-json', DEK)).toThrow(
      DecryptionError
    );
  });

  it('throws DecryptionError for an invalid IV length', () => {
    const bad = Buffer.from(
      JSON.stringify({
        iv: Buffer.alloc(4).toString('base64'), // not 12 bytes
        data: 'AAAA',
        tag: Buffer.alloc(16).toString('base64'),
      })
    ).toString('base64');
    expect(() => decryptPayload(bad, DEK)).toThrow(DecryptionError);
  });
});
