import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { describe, expect, it } from 'vitest';

const DEK = Buffer.alloc(32, 7);

describe('crypto — AES-256-GCM payload envelope', () => {
  it('round-trips empty, unicode, and long strings', async () => {
    for (const text of ['', 'hello', 'café — 日本語 — 🔐', 'x'.repeat(5000)]) {
      const sealed = await encryptPayload(text, DEK);
      expect(await decryptPayload(sealed, DEK)).toBe(text);
    }
  });

  it('produces a unique IV per call (no ciphertext reuse)', async () => {
    const a = await encryptPayload('same', DEK);
    const b = await encryptPayload('same', DEK);
    expect(a).not.toBe(b);
  });

  it('throws DecryptionError for the wrong key', async () => {
    const sealed = await encryptPayload('secret', DEK);
    const wrong = Buffer.alloc(32, 9);
    await expect(decryptPayload(sealed, wrong)).rejects.toBeInstanceOf(
      DecryptionError
    );
  });

  it('throws DecryptionError when the ciphertext is tampered', async () => {
    const sealed = await encryptPayload('secret', DEK);
    const decoded = JSON.parse(Buffer.from(sealed, 'base64').toString('utf8'));
    // flip a byte in the data field
    const dataBuf = Buffer.from(decoded.data, 'base64');
    dataBuf[0] ^= 0xff;
    decoded.data = dataBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');

    await expect(decryptPayload(tampered, DEK)).rejects.toBeInstanceOf(
      DecryptionError
    );
  });

  it('throws DecryptionError when the auth tag is tampered', async () => {
    const sealed = await encryptPayload('secret', DEK);
    const decoded = JSON.parse(Buffer.from(sealed, 'base64').toString('utf8'));
    const tagBuf = Buffer.from(decoded.tag, 'base64');
    tagBuf[0] ^= 0xff;
    decoded.tag = tagBuf.toString('base64');
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');

    await expect(decryptPayload(tampered, DEK)).rejects.toBeInstanceOf(
      DecryptionError
    );
  });

  it('throws DecryptionError (not a raw error) for malformed input', async () => {
    await expect(
      decryptPayload('not-valid-base64-json', DEK)
    ).rejects.toBeInstanceOf(DecryptionError);
  });

  it('throws DecryptionError for an invalid IV length', async () => {
    const bad = Buffer.from(
      JSON.stringify({
        iv: Buffer.alloc(4).toString('base64'), // not 12 bytes
        data: 'AAAA',
        tag: Buffer.alloc(16).toString('base64'),
      })
    ).toString('base64');
    await expect(decryptPayload(bad, DEK)).rejects.toBeInstanceOf(
      DecryptionError
    );
  });
});
