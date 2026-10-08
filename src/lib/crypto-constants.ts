/**
 * Shared crypto parameters used by both server (`@/lib/keystore`) and client
 * (`@/lib/client-crypto`) so derivation stays in lock-step across both sides.
 */

// v2 PBKDF2: OWASP 2025 minimum / FIPS-140 recommended for SHA-256.
// Per-user salt = Supabase user id.
export const V2_ITERATIONS = 600000;

// 256 bits for AES-256
export const KEY_LEN_BYTES = 32;
export const PBKDF2_DIGEST = 'sha256';
