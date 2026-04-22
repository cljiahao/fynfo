// Must match the server-side constants in keystore.ts exactly so derived bytes are identical.
const PBKDF2_SALT = 'fynfo_v1_salt';
const ITERATIONS = 100000;

/**
 * Derives the 256-bit DEK from a PIN in the browser using Web Crypto PBKDF2.
 * Offloads the expensive key-stretching from the server to the client,
 * and can be started the moment the 6th digit is typed (before submit).
 * Returns the key as a base64 string for transport.
 */
export async function deriveKeyClient(pin: string): Promise<string> {
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
      salt: new TextEncoder().encode(PBKDF2_SALT),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const bytes = new Uint8Array(bits);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
