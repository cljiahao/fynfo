import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

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
 * Seals a plaintext string into the session-cookie envelope:
 * base64(JSON{iv,data,tag}) under AES-256-GCM. Single source of truth shared by
 * the vault route (seal) and the keystore (open) so the format never drifts.
 */
export function sealCookie(plaintext: string): string {
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
 * Opens a blob produced by {@link sealCookie}. Throws if the envelope is
 * malformed (bad iv/tag length) or fails authentication (tamper / wrong secret).
 */
export function openCookie(blob: string): string {
  const payloadStr = Buffer.from(blob, 'base64').toString('utf8');
  const { iv, data, tag } = JSON.parse(payloadStr) as {
    iv: string;
    data: string;
    tag: string;
  };

  const ivBuf = Buffer.from(iv, 'base64');
  const tagBuf = Buffer.from(tag, 'base64');
  if (ivBuf.length !== IV_LENGTH || tagBuf.length !== TAG_LENGTH) {
    throw new Error('invalid cookie envelope');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, cookieKey(), ivBuf);
  decipher.setAuthTag(tagBuf);

  let out = decipher.update(data, 'base64', 'utf8');
  out += decipher.final('utf8');
  return out;
}
