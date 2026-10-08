import { HOUSEHOLD_COOKIE_MAX_AGE } from '@/lib/household-cookie';
import { VAULT_COOKIE_MAX_AGE } from '@/lib/vault-cookie';
import crypto from 'crypto';
import { z } from 'zod';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MAX_COOKIE_LENGTH = 4096;
const PURPOSE_SCHEMA = z.enum(['vault-dek', 'household-kh']);
export type KeyCookiePurpose = z.infer<typeof PURPOSE_SCHEMA>;
const USER_ID_SCHEMA = z.string().min(1).max(128).regex(/^\S+$/);
const SEALED_SCHEMA = z
  .object({ iv: z.string(), data: z.string().min(1), tag: z.string() })
  .strict();
const KEY_ENVELOPE_SCHEMA = z
  .object({
    version: z.literal(1),
    userId: USER_ID_SCHEMA,
    purpose: PURPOSE_SCHEMA,
    key: z.string(),
    issuedAt: z.number().int().nonnegative().safe(),
    expiresAt: z.number().int().nonnegative().safe(),
  })
  .strict();

function invalidCookie(): never {
  throw new Error('invalid cookie envelope');
}

function canonicalBase64(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) invalidCookie();
  return decoded;
}

function validateKey(key: string): void {
  if (canonicalBase64(key).length !== 32) invalidCookie();
}

function validateContext(userId: string, purpose: KeyCookiePurpose): void {
  if (
    !USER_ID_SCHEMA.safeParse(userId).success ||
    !PURPOSE_SCHEMA.safeParse(purpose).success
  )
    invalidCookie();
}

function maxAge(purpose: KeyCookiePurpose): number {
  return purpose === 'vault-dek'
    ? VAULT_COOKIE_MAX_AGE
    : HOUSEHOLD_COOKIE_MAX_AGE;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret)
    throw new Error('SESSION_SECRET environment variable is not set');
  return secret;
}

// AES key for the cookie envelope: SHA-256 of the session secret.
function cookieKey(): Buffer {
  return crypto.createHash('sha256').update(getSessionSecret()).digest();
}

/**
 * Seals a canonical 256-bit key with its authenticated owner, purpose and
 * absolute server lifetime. Callers supply identity after authenticating it.
 */
export function sealCookie(
  key: string,
  userId: string,
  purpose: KeyCookiePurpose
): string {
  validateContext(userId, purpose);
  validateKey(key);
  const issuedAt = Math.floor(Date.now() / 1000);
  const plaintext = JSON.stringify({
    version: 1,
    userId,
    purpose,
    key,
    issuedAt,
    expiresAt: issuedAt + maxAge(purpose),
  });
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, cookieKey(), iv);
  let data = cipher.update(plaintext, 'utf8', 'base64');
  data += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');

  const payload = JSON.stringify({
    iv: iv.toString('base64'),
    data,
    tag,
  });
  return Buffer.from(payload).toString('base64');
}

/**
 * Returns a key only for the authenticated owner and expected purpose within
 * its server lifetime. Legacy, malformed and tampered envelopes fail closed.
 */
export function openCookie(
  blob: string,
  userId: string,
  purpose: KeyCookiePurpose
): string {
  validateContext(userId, purpose);
  if (blob.length > MAX_COOKIE_LENGTH) invalidCookie();
  const payload = SEALED_SCHEMA.safeParse(
    JSON.parse(canonicalBase64(blob).toString('utf8')) as unknown
  );
  if (!payload.success) invalidCookie();
  const { iv, data, tag } = payload.data;
  const ivBuf = canonicalBase64(iv);
  const tagBuf = canonicalBase64(tag);
  if (ivBuf.length !== IV_LENGTH || tagBuf.length !== TAG_LENGTH) {
    invalidCookie();
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, cookieKey(), ivBuf);
  decipher.setAuthTag(tagBuf);

  let out = decipher.update(canonicalBase64(data), undefined, 'utf8');
  out += decipher.final('utf8');
  const envelope = KEY_ENVELOPE_SCHEMA.safeParse(JSON.parse(out) as unknown);
  if (!envelope.success) invalidCookie();
  const now = Math.floor(Date.now() / 1000);
  const value = envelope.data;
  if (
    value.userId !== userId ||
    value.purpose !== purpose ||
    value.issuedAt > now ||
    value.expiresAt <= now ||
    value.expiresAt - value.issuedAt !== maxAge(purpose)
  )
    invalidCookie();
  validateKey(value.key);
  return value.key;
}
