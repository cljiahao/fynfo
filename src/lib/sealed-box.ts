import 'server-only';

import { decryptPayload, encryptPayload } from '@/lib/crypto';
import crypto from 'node:crypto';
import { z } from 'zod';

// Version 1 construction, specified in specs/security/204-investment-api.md:
// ephemeral X25519 -> HKDF-SHA256 -> AES-256-GCM, bound to both public keys via AAD.
const INFO_V1 = 'fynfo-sealed-v1';
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');
const X25519_PKCS8_PREFIX = Buffer.from(
  '302e020100300506032b656e04220420',
  'hex'
);

export class SealedBoxError extends Error {
  constructor(message = 'sealed box operation failed') {
    super(message);
    this.name = 'SealedBoxError';
  }
}

const B64URL = /^[A-Za-z0-9_-]+$/;
const envelopeSchema = z.object({
  v: z.literal(1),
  epk: z.string().regex(B64URL),
  n: z.string().regex(B64URL),
  ct: z.string().regex(B64URL),
});

export type JournalKeyPair = {
  /** Raw 32-byte X25519 public key. */
  publicKey: Buffer;
  /** Raw 32-byte X25519 private key; never persist unwrapped. */
  privateKey: Buffer;
};

function publicKeyObject(raw: Uint8Array): crypto.KeyObject {
  if (raw.length !== KEY_LENGTH) throw new SealedBoxError('invalid key');
  return crypto.createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

function privateKeyObject(raw: Uint8Array): crypto.KeyObject {
  if (raw.length !== KEY_LENGTH) throw new SealedBoxError('invalid key');
  return crypto.createPrivateKey({
    key: Buffer.concat([X25519_PKCS8_PREFIX, raw]),
    format: 'der',
    type: 'pkcs8',
  });
}

function rawPublic(key: crypto.KeyObject): Buffer {
  const jwk = key.export({ format: 'jwk' });
  if (!jwk.x) throw new SealedBoxError('invalid key');
  return Buffer.from(jwk.x, 'base64url');
}

function rawPrivate(key: crypto.KeyObject): Buffer {
  const jwk = key.export({ format: 'jwk' });
  if (!jwk.d) throw new SealedBoxError('invalid key');
  return Buffer.from(jwk.d, 'base64url');
}

function deriveKey(
  shared: Buffer,
  ephemeralPublic: Buffer,
  recipientPublic: Buffer
): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      shared,
      Buffer.concat([ephemeralPublic, recipientPublic]),
      INFO_V1,
      KEY_LENGTH
    )
  );
}

function aad(ephemeralPublic: Buffer, recipientPublic: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(INFO_V1, 'utf8'),
    ephemeralPublic,
    recipientPublic,
  ]);
}

function encode(epk: Buffer, nonce: Buffer, ct: Buffer): string {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      epk: epk.toString('base64url'),
      n: nonce.toString('base64url'),
      ct: ct.toString('base64url'),
    }),
    'utf8'
  ).toString('base64url');
}

/**
 * Fixed ephemeral key and nonce exist only so published test vectors are reproducible.
 * Production code must call `seal`, which draws both from the system CSPRNG.
 */
export function sealWithFixedInputs(
  recipientPublic: Uint8Array,
  plaintext: Uint8Array | string,
  ephemeralPrivate: Uint8Array,
  nonce: Uint8Array
): string {
  if (nonce.length !== NONCE_LENGTH) throw new SealedBoxError('invalid nonce');
  const recipient = Buffer.from(recipientPublic);
  const ephemeralKey = privateKeyObject(ephemeralPrivate);
  const ephemeralPublic = rawPublic(crypto.createPublicKey(ephemeralKey));
  let key: Buffer;
  try {
    const shared = crypto.diffieHellman({
      privateKey: ephemeralKey,
      publicKey: publicKeyObject(recipient),
    });
    key = deriveKey(shared, ephemeralPublic, recipient);
  } catch {
    throw new SealedBoxError('invalid key');
  }
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(aad(ephemeralPublic, recipient));
  const body = Buffer.concat([
    cipher.update(
      typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext
    ),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encode(ephemeralPublic, Buffer.from(nonce), body);
}

export function seal(
  recipientPublic: Uint8Array,
  plaintext: Uint8Array | string
): string {
  const ephemeral = crypto.generateKeyPairSync('x25519');
  return sealWithFixedInputs(
    recipientPublic,
    plaintext,
    rawPrivate(ephemeral.privateKey),
    crypto.randomBytes(NONCE_LENGTH)
  );
}

export function open(recipientPrivate: Uint8Array, envelope: string): Buffer {
  try {
    const parsed = envelopeSchema.parse(
      JSON.parse(Buffer.from(envelope, 'base64url').toString('utf8'))
    );
    const epk = Buffer.from(parsed.epk, 'base64url');
    const nonce = Buffer.from(parsed.n, 'base64url');
    const ct = Buffer.from(parsed.ct, 'base64url');
    if (
      epk.length !== KEY_LENGTH ||
      nonce.length !== NONCE_LENGTH ||
      ct.length < TAG_LENGTH
    ) {
      throw new SealedBoxError();
    }
    const privateKey = privateKeyObject(recipientPrivate);
    const recipientPublic = rawPublic(crypto.createPublicKey(privateKey));
    const shared = crypto.diffieHellman({
      privateKey,
      publicKey: publicKeyObject(epk),
    });
    const key = deriveKey(shared, epk, recipientPublic);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAAD(aad(epk, recipientPublic));
    decipher.setAuthTag(ct.subarray(ct.length - TAG_LENGTH));
    return Buffer.concat([
      decipher.update(ct.subarray(0, ct.length - TAG_LENGTH)),
      decipher.final(),
    ]);
  } catch {
    // One opaque failure for every cause so callers cannot build an oracle.
    throw new SealedBoxError();
  }
}

export function generateJournalKeyPair(): JournalKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return {
    publicKey: rawPublic(publicKey),
    privateKey: rawPrivate(privateKey),
  };
}

export function wrapJournalPrivateKey(
  privateKey: Uint8Array,
  dek: Buffer
): string {
  if (privateKey.length !== KEY_LENGTH) throw new SealedBoxError('invalid key');
  return encryptPayload(Buffer.from(privateKey).toString('base64'), dek);
}

export function unwrapJournalPrivateKey(wrapped: string, dek: Buffer): Buffer {
  const raw = Buffer.from(decryptPayload(wrapped, dek), 'base64');
  if (raw.length !== KEY_LENGTH) throw new SealedBoxError('invalid key');
  return raw;
}
