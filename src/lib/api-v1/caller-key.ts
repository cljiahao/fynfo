import 'server-only';

import { z } from 'zod';

const SCHEME = 'Fynfo-Ed25519';
const ED25519_SIGNATURE_BYTES = 64;

const AUTH_HEADER = new RegExp(`^${SCHEME} keyId=([0-9a-fA-F-]{36})$`);
const keyIdSchema = z.uuid();
// Unix seconds; ten digits covers every date until the year 2286.
const timestampSchema = z.string().regex(/^\d{1,10}$/);
const signatureSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]{86}==$/)
  .refine((v) => Buffer.from(v, 'base64').length === ED25519_SIGNATURE_BYTES);

export type SignedRequestHeaders = {
  keyId: string;
  /** Unix seconds, exactly as sent (it is part of the signed canonical string). */
  timestamp: string;
  signature: string;
};

export type ParsedKeyId =
  | { ok: true; keyId: string }
  | { ok: false; reason: 'malformed' };

export type ParsedSignedRequestHeaders =
  | { ok: true; value: SignedRequestHeaders }
  | { ok: false; reason: 'malformed' };

export function parseAuthorizationHeader(header: string | null): ParsedKeyId {
  if (header === null) return { ok: false, reason: 'malformed' };
  const match = AUTH_HEADER.exec(header);
  const parsed = keyIdSchema.safeParse(match?.[1]);
  if (!parsed.success) return { ok: false, reason: 'malformed' };
  // Lower-case so the signed canonical string is identical for any casing the caller sends.
  return { ok: true, keyId: parsed.data.toLowerCase() };
}

export function parseSignedRequestHeaders(
  headers: Pick<Headers, 'get'>
): ParsedSignedRequestHeaders {
  const key = parseAuthorizationHeader(headers.get('authorization'));
  const timestamp = timestampSchema.safeParse(
    headers.get('x-fynfo-timestamp') ?? undefined
  );
  const signature = signatureSchema.safeParse(
    headers.get('x-fynfo-signature') ?? undefined
  );
  if (!key.ok || !timestamp.success || !signature.success) {
    return { ok: false, reason: 'malformed' };
  }
  return {
    ok: true,
    value: {
      keyId: key.keyId,
      timestamp: timestamp.data,
      signature: signature.data,
    },
  };
}
