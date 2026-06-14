import { KEY_LEN_BYTES, V2_ITERATIONS } from '@/lib/crypto-constants';

// v1: static salt — used by accounts before per-user salt migration
const PBKDF2_SALT_V1 = 'fynfo_v1_salt';

async function pbkdf2(pin: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: V2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LEN_BYTES * 8
  );

  const bytes = new Uint8Array(bits);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Derives the 256-bit DEK using the v2 per-user salt scheme.
 * Call this for all new unlock attempts. Kicks off as soon as the
 * 6th digit is typed (before submit) to hide PBKDF2 latency.
 */
export function deriveKeyClient(pin: string, userId: string): Promise<string> {
  return pbkdf2(pin, userId);
}

/**
 * Derives the DEK using the v1 static salt — only used during one-time
 * migration of existing accounts to the per-user salt scheme.
 */
export function deriveKeyLegacy(pin: string): Promise<string> {
  return pbkdf2(pin, PBKDF2_SALT_V1);
}
