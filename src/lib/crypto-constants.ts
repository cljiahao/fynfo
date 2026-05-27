/**
 * Shared crypto parameters used by both server (`@/lib/keystore`) and client
 * (`@/lib/client-crypto`) so v1 ↔ v2 derivation stays in lock-step across both
 * sides. Do not edit without bumping the version + writing a rekey spec.
 */

// v1 (legacy): retained only for unlock-and-rekey of pre-2026-05-27 vaults.
export const V1_PBKDF2_SALT = 'fynfo_v1_salt';
export const V1_ITERATIONS = 100000;

// Intermediate (feat/logo-redesign, b71cd15): partial-migration salvage only.
// Same iteration count as v1 with a per-user salt prefix.
export const INTERMEDIATE_PBKDF2_SALT_PREFIX = 'fynfo_v2_';
export const INTERMEDIATE_ITERATIONS = 100000;

// v2 (current OWASP 2025 minimum): per-user salt = Supabase user id.
export const V2_ITERATIONS = 600000;

export const KEY_LEN_BYTES = 32; // 256 bits for AES-256
export const PBKDF2_DIGEST = 'sha256';
