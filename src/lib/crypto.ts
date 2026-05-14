import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const TAG_LENGTH = 16; // AES-GCM auth tag

export class DecryptionError extends Error {
  constructor(message = 'decryption failed') {
    super(message);
    this.name = 'DecryptionError';
  }
}

export function encryptPayload(text: string, dek: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag().toString('base64');

  const payloadStr = JSON.stringify({
    iv: iv.toString('base64'),
    data: encrypted,
    tag: authTag,
  });

  return Buffer.from(payloadStr).toString('base64');
}

export function decryptPayload(encryptedBase64: string, dek: Buffer): string {
  try {
    const payloadStr = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const { iv, data, tag } = JSON.parse(payloadStr);

    const ivBuf = Buffer.from(iv, 'base64');
    const tagBuf = Buffer.from(tag, 'base64');
    if (ivBuf.length !== IV_LENGTH || tagBuf.length !== TAG_LENGTH) {
      throw new DecryptionError();
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, dek, ivBuf);
    decipher.setAuthTag(tagBuf);

    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    throw new DecryptionError();
  }
}
