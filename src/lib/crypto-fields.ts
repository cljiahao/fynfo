import { decryptPayload } from '@/lib/crypto';

/**
 * Per-field decrypt helpers shared by the feature server actions. Thin, literal
 * wrappers over `decryptPayload` so the optional/number guards live (and are
 * tested) in one place instead of being hand-rolled at every read site.
 */

/** Decrypt a required ciphertext to a number. */
export function decryptNumber(cipher: string, dek: Buffer): number {
  return Number(decryptPayload(cipher, dek));
}

/** Decrypt an optional ciphertext to a string; `''` when absent/empty. */
export function decryptOptionalString(
  cipher: string | null | undefined,
  dek: Buffer
): string {
  return cipher ? decryptPayload(cipher, dek) : '';
}

/** Decrypt an optional ciphertext to a number; `fallback` when absent/empty. */
export function decryptOptionalNumber(
  cipher: string | null | undefined,
  dek: Buffer,
  fallback = 0
): number {
  return cipher ? Number(decryptPayload(cipher, dek)) : fallback;
}
