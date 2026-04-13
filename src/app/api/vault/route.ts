import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { deriveKeyFromPin, getSessionSecret } from '@/lib/keystore';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Encrypts the raw DEK so it is safe to be stored inside a browser cookie.
 * Even though the cookie is HttpOnly, encrypting it prevents exposure against
 * hypothetical XSS/header-reading attacks.
 */
function encryptCookiePayload(data: string): string {
  const iv = crypto.randomBytes(12);
  const aesKey = crypto
    .createHash('sha256')
    .update(getSessionSecret())
    .digest();

  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return JSON.stringify({
    iv: iv.toString('base64'),
    data: encrypted,
    tag: authTag,
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pin } = (await req.json()) as { pin?: string };
    if (!pin || pin.length < 6) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 });
    }

    // 1. Derive the 256-bit DEK using PBKDF2 from the PIN.
    const masterKeyBuffer = deriveKeyFromPin(pin);
    const masterKeyBase64 = masterKeyBuffer.toString('base64');

    // 2. Encrypt the DEK with the server-side SESSION_SECRET before storing in cookie.
    const secureCookieBlob = Buffer.from(
      encryptCookiePayload(masterKeyBase64)
    ).toString('base64');

    // 3. Store in a strictly locked-down HttpOnly cookie.
    const cookieStore = await cookies();
    cookieStore.set('fynfo_vault_dek', secureCookieBlob, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 6, // 6-hour session
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vault API failure:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
