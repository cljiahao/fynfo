import 'server-only';

import crypto from 'node:crypto';

export const SIGNATURE_WINDOW_SECONDS = 300;

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ED25519_PUBLIC_KEY_BYTES = 32;

export type SignedRequest = {
  keyId: string;
  /** Unix seconds as sent by the caller. */
  timestamp: string;
  method: string;
  /** Request path including the query string, exactly as received. */
  pathWithQuery: string;
  body: string | Uint8Array;
};

export type VerifyResult =
  | { ok: true; nonceExpiresAt: Date }
  | {
      ok: false;
      reason: 'bad_timestamp' | 'stale_timestamp' | 'bad_key' | 'bad_signature';
    };

export function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function buildCanonicalString(request: SignedRequest): string {
  return [
    'fynfo-req-v1',
    request.keyId,
    request.timestamp,
    request.method.toUpperCase(),
    request.pathWithQuery,
    sha256Hex(request.body),
  ].join('\n');
}

export function isTimestampFresh(
  timestamp: string,
  nowMs: number = Date.now()
): boolean {
  if (!/^\d{1,10}$/.test(timestamp)) return false;
  return Math.abs(nowMs / 1000 - Number(timestamp)) <= SIGNATURE_WINDOW_SECONDS;
}

/** Replay hash stored in the nonce table: SHA-256 of the raw signature bytes. */
export function signatureNonceHash(signatureBase64: string): string {
  return sha256Hex(Buffer.from(signatureBase64, 'base64'));
}

function publicKeyFromRaw(rawBase64: string): crypto.KeyObject | null {
  const raw = Buffer.from(rawBase64, 'base64');
  if (raw.length !== ED25519_PUBLIC_KEY_BYTES) return null;
  try {
    return crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: 'der',
      type: 'spki',
    });
  } catch {
    return null;
  }
}

export function verifyRequestSignature(
  request: SignedRequest,
  publicKeyBase64: string,
  signatureBase64: string,
  nowMs: number = Date.now()
): VerifyResult {
  if (!/^\d{1,10}$/.test(request.timestamp)) {
    return { ok: false, reason: 'bad_timestamp' };
  }
  if (!isTimestampFresh(request.timestamp, nowMs)) {
    return { ok: false, reason: 'stale_timestamp' };
  }
  const key = publicKeyFromRaw(publicKeyBase64);
  if (!key) return { ok: false, reason: 'bad_key' };
  const signature = Buffer.from(signatureBase64, 'base64');
  let valid = false;
  try {
    valid = crypto.verify(
      null,
      Buffer.from(buildCanonicalString(request), 'utf8'),
      key,
      signature
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad_signature' };
  return {
    ok: true,
    nonceExpiresAt: new Date(
      (Number(request.timestamp) + SIGNATURE_WINDOW_SECONDS) * 1000
    ),
  };
}
