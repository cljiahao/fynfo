import { decryptPayload } from '@/lib/crypto';

/**
 * Per-field decrypt helpers shared by the feature server actions. Thin, literal
 * wrappers over `decryptPayload` so the optional/number guards live (and are
 * tested) in one place instead of being hand-rolled at every read site.
 */

/** Decrypt a required ciphertext to a number. */
export async function decryptNumber(
  cipher: string,
  dek: Buffer
): Promise<number> {
  return Number(await decryptPayload(cipher, dek));
}

/** Decrypt an optional ciphertext to a string; `''` when absent/empty. */
export async function decryptOptionalString(
  cipher: string | null | undefined,
  dek: Buffer
): Promise<string> {
  return cipher ? decryptPayload(cipher, dek) : '';
}

/** Decrypt an optional ciphertext to a number; `fallback` when absent/empty. */
export async function decryptOptionalNumber(
  cipher: string | null | undefined,
  dek: Buffer,
  fallback = 0
): Promise<number> {
  return cipher ? Number(await decryptPayload(cipher, dek)) : fallback;
}
