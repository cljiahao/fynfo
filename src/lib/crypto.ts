import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

/**
 * Encrypts a plaintext string using the provided symmetric Data Encryption Key (DEK).
 * Uses AES-256-GCM to provide both confidentiality and authenticity.
 */
export async function encryptPayload(
  text: string,
  dek: Buffer
): Promise<string> {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag().toString('base64');

  // Package into a single string for DB storage
  const payloadStr = JSON.stringify({
    iv: iv.toString('base64'),
    data: encrypted,
    tag: authTag,
  });

  return Buffer.from(payloadStr).toString('base64');
}

/**
 * Decrypts a payload string back to plaintext using the symmetric DEK.
 */
export async function decryptPayload(
  encryptedBase64: string,
  dek: Buffer
): Promise<string> {
  try {
    const payloadStr = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const { iv, data, tag } = JSON.parse(payloadStr);

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      dek,
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    console.error('Decryption failed, returning fallback empty state.');
    return ''; // Return an empty string if it fails to decrypt (e.g. wrong key)
  }
}
