import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { getSessionSecret } from '@/lib/keystore';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const VAULT_CANARY = 'fynfo_vault_ok';

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
    const [supabase, { derivedKey }] = await Promise.all([
      createSupabaseServerClient(),
      req.json() as Promise<{ derivedKey?: string }>,
    ]);

    if (!derivedKey) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const dek = Buffer.from(derivedKey, 'base64');
    if (dek.length !== 32) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the stored vault_check canary for this user (may be null on first unlock)
    const { data: profile } = await supabase
      .from('users_profile')
      .select('vault_check')
      .eq('id', user.id)
      .single();

    if (profile?.vault_check) {
      // Verify PIN: try to decrypt the canary — wrong PIN produces "" due to AES-GCM auth failure
      const decrypted = await decryptPayload(profile.vault_check, dek);
      if (decrypted !== VAULT_CANARY) {
        return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
      }
    } else {
      // First unlock: encrypt and store the canary
      const encryptedCanary = await encryptPayload(VAULT_CANARY, dek);
      const { error: upsertError } = await supabase
        .from('users_profile')
        .upsert({
          id: user.id,
          email: user.email ?? '',
          vault_check: encryptedCanary,
        });

      if (upsertError) {
        console.error('Failed to store vault canary:', upsertError);
        return NextResponse.json(
          { error: 'Failed to initialize vault' },
          { status: 500 }
        );
      }
    }

    // PIN is correct — encrypt the DEK and store in HttpOnly cookie
    const masterKeyBase64 = dek.toString('base64');
    const secureCookieBlob = Buffer.from(
      encryptCookiePayload(masterKeyBase64)
    ).toString('base64');

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
