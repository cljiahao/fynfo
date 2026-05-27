// Must match server-side derivation in @/lib/keystore exactly so derived bytes
// are identical across browser and server. Both sides read constants from
// @/lib/crypto-constants.
import { KEY_LEN_BYTES, V2_ITERATIONS } from '@/lib/crypto-constants';

async function deriveBitsBase64(
  pin: string,
  salt: string,
  iterations: number
): Promise<string> {
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
      iterations,
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
 * v2 DEK derivation. Per-user salt (Supabase user id) + 600k iterations
 * (OWASP 2025 PBKDF2-HMAC-SHA-256 minimum / FIPS-140 recommended).
 */
export async function deriveKeyClientV2(
  pin: string,
  userId: string
): Promise<string> {
  return deriveBitsBase64(pin, userId, V2_ITERATIONS);
}
