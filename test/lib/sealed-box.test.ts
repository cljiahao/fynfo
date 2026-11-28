import {
  SealedBoxError,
  generateJournalKeyPair,
  open,
  seal,
  sealWithFixedInputs,
  unwrapJournalPrivateKey,
  wrapJournalPrivateKey,
} from '@/lib/sealed-box';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

// Published vector: callers in other languages must reproduce and open it.
// Keys are made up and must never be used outside tests.
const sequence = (start: number, length: number): Buffer =>
  Buffer.from(Array.from({ length }, (_, i) => start + i));
const VECTOR = {
  recipientPrivate: sequence(0x01, 32),
  ephemeralPrivate: sequence(0x21, 32),
  nonce: sequence(0x41, 12),
  plaintext:
    '{"surplus":1234.56,"weekly_budget":300,"currency":"SGD","as_of":"2026-11-27"}',
  envelope:
    'eyJ2IjoxLCJlcGsiOiJXR212OUZCVWx6TExxdTFlWGZtekNtMmpITERsZEN1dFd0U2hwMmp4cG5zIiwibiI6IlFVSkRSRVZHUjBoSlNrdE0iLCJjdCI6Ik91SGFmZExxUlgwTjR2RGlFeUFXUEJqeVBBVU50SGVhN1M4Q29fUkE3UGhsaHFnQnMxRlh6Zmx5eWVNdUV6M1VLbTc1SFRWMVZSSzN6NVdyemxBT0xkdzRPNHdXSlRkM1ltY19YR2JYMi1pT2NDWkIyWm1hbDd2b2Z5U0gifQ',
};

function publicOf(privateRaw: Buffer): Buffer {
  const key = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b656e04220420', 'hex'),
      privateRaw,
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const jwk = crypto.createPublicKey(key).export({ format: 'jwk' });
  return Buffer.from(jwk.x ?? '', 'base64url');
}

function mutateEnvelope(
  envelope: string,
  change: (parsed: Record<string, string | number>) => void
): string {
  const parsed = JSON.parse(
    Buffer.from(envelope, 'base64url').toString('utf8')
  ) as Record<string, string | number>;
  change(parsed);
  return Buffer.from(JSON.stringify(parsed)).toString('base64url');
}

function flipFirstByte(b64url: string): string {
  const bytes = Buffer.from(b64url, 'base64url');
  bytes[0] ^= 0x01;
  return bytes.toString('base64url');
}

function flipLastByte(b64url: string): string {
  const bytes = Buffer.from(b64url, 'base64url');
  bytes[bytes.length - 1] ^= 0x01;
  return bytes.toString('base64url');
}

describe('sealed-box', () => {
  const recipientPublic = publicOf(VECTOR.recipientPrivate);

  it('reproduces the published vector and opens it', () => {
    const envelope = sealWithFixedInputs(
      recipientPublic,
      VECTOR.plaintext,
      VECTOR.ephemeralPrivate,
      VECTOR.nonce
    );
    expect(envelope).toBe(VECTOR.envelope);
    expect(open(VECTOR.recipientPrivate, VECTOR.envelope).toString()).toBe(
      VECTOR.plaintext
    );
  });

  it('uses the documented envelope layout', () => {
    const parsed = JSON.parse(
      Buffer.from(VECTOR.envelope, 'base64url').toString('utf8')
    ) as Record<string, string | number>;
    expect(Object.keys(parsed)).toEqual(['v', 'epk', 'n', 'ct']);
    expect(parsed.v).toBe(1);
    expect(Buffer.from(String(parsed.epk), 'base64url')).toHaveLength(32);
    expect(Buffer.from(String(parsed.n), 'base64url')).toHaveLength(12);
    expect(Buffer.from(String(parsed.ct), 'base64url')).toHaveLength(
      Buffer.byteLength(VECTOR.plaintext) + 16
    );
  });

  it('round-trips random keys and gives fresh ciphertext each time', () => {
    const pair = generateJournalKeyPair();
    const a = seal(pair.publicKey, 'hello');
    const b = seal(pair.publicKey, 'hello');
    expect(a).not.toBe(b);
    expect(open(pair.privateKey, a).toString()).toBe('hello');
    expect(open(pair.privateKey, seal(pair.publicKey, '')).length).toBe(0);
  });

  it('rejects a tampered ciphertext', () => {
    const bad = mutateEnvelope(VECTOR.envelope, (p) => {
      p.ct = flipFirstByte(String(p.ct));
    });
    expect(() => open(VECTOR.recipientPrivate, bad)).toThrow(SealedBoxError);
  });

  it('rejects a tampered tag', () => {
    const bad = mutateEnvelope(VECTOR.envelope, (p) => {
      p.ct = flipLastByte(String(p.ct));
    });
    expect(() => open(VECTOR.recipientPrivate, bad)).toThrow(SealedBoxError);
  });

  it('rejects a tampered ephemeral key', () => {
    const bad = mutateEnvelope(VECTOR.envelope, (p) => {
      p.epk = flipFirstByte(String(p.epk));
    });
    expect(() => open(VECTOR.recipientPrivate, bad)).toThrow(SealedBoxError);
  });

  it('rejects a swapped nonce', () => {
    const bad = mutateEnvelope(VECTOR.envelope, (p) => {
      p.n = flipFirstByte(String(p.n));
    });
    expect(() => open(VECTOR.recipientPrivate, bad)).toThrow(SealedBoxError);
  });

  it('binds the AAD: an envelope sealed to another recipient cannot be redirected', () => {
    const other = generateJournalKeyPair();
    const envelope = seal(other.publicKey, 'secret');
    // Same envelope, opened by the intended key, still works; any other key fails.
    expect(open(other.privateKey, envelope).toString()).toBe('secret');
    expect(() => open(VECTOR.recipientPrivate, envelope)).toThrow(
      SealedBoxError
    );
  });

  it('fails with the wrong private key', () => {
    const wrong = generateJournalKeyPair();
    expect(() => open(wrong.privateKey, VECTOR.envelope)).toThrow(
      SealedBoxError
    );
  });

  it('rejects unknown versions and malformed envelopes', () => {
    const v2 = mutateEnvelope(VECTOR.envelope, (p) => {
      p.v = 2;
    });
    expect(() => open(VECTOR.recipientPrivate, v2)).toThrow(SealedBoxError);
    for (const junk of [
      '',
      'not-json',
      Buffer.from('{}').toString('base64url'),
    ]) {
      expect(() => open(VECTOR.recipientPrivate, junk)).toThrow(SealedBoxError);
    }
    const short = mutateEnvelope(VECTOR.envelope, (p) => {
      p.ct = 'AAAA';
    });
    expect(() => open(VECTOR.recipientPrivate, short)).toThrow(SealedBoxError);
  });

  it('rejects an all-zero (low-order) ephemeral key and bad key lengths', () => {
    const zero = mutateEnvelope(VECTOR.envelope, (p) => {
      p.epk = Buffer.alloc(32).toString('base64url');
    });
    expect(() => open(VECTOR.recipientPrivate, zero)).toThrow(SealedBoxError);
    expect(() => seal(Buffer.alloc(31), 'x')).toThrow(SealedBoxError);
    expect(() => seal(Buffer.alloc(32), 'x')).toThrow(SealedBoxError);
    expect(() => open(Buffer.alloc(5), VECTOR.envelope)).toThrow(
      SealedBoxError
    );
    expect(() =>
      sealWithFixedInputs(
        recipientPublic,
        'x',
        VECTOR.ephemeralPrivate,
        Buffer.alloc(11)
      )
    ).toThrow(SealedBoxError);
  });
});

describe('journal key wrapping', () => {
  const dek = crypto.randomBytes(32);

  it('wraps and unwraps the private key under the DEK', () => {
    const pair = generateJournalKeyPair();
    expect(pair.publicKey).toHaveLength(32);
    expect(pair.privateKey).toHaveLength(32);
    const wrapped = wrapJournalPrivateKey(pair.privateKey, dek);
    expect(wrapped).not.toContain(pair.privateKey.toString('base64'));
    const unwrapped = unwrapJournalPrivateKey(wrapped, dek);
    expect(unwrapped.equals(pair.privateKey)).toBe(true);
    const envelope = seal(pair.publicKey, 'event');
    expect(open(unwrapped, envelope).toString()).toBe('event');
  });

  it('fails to unwrap under a different DEK and rejects bad key sizes', () => {
    const pair = generateJournalKeyPair();
    const wrapped = wrapJournalPrivateKey(pair.privateKey, dek);
    expect(() =>
      unwrapJournalPrivateKey(wrapped, crypto.randomBytes(32))
    ).toThrow();
    expect(() => wrapJournalPrivateKey(Buffer.alloc(31), dek)).toThrow(
      SealedBoxError
    );
  });
});
