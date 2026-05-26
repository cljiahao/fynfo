import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, handleApiError } from '@/lib/errors';
import { getSessionSecret } from '@/lib/keystore';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/utils/with-logging';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const VAULT_CANARY = 'fynfo_vault_ok';

const VaultUnlockSchema = z.object({
  derivedKey: z
    .string()
    .min(1, 'derivedKey is required')
    .refine(
      (v) => {
        try {
          return Buffer.from(v, 'base64').length === 32;
        } catch {
          return false;
        }
      },
      { message: 'derivedKey must be base64-encoded 32-byte value' }
    ),
});

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

export const POST = withLogging('api.vault.unlock', async (req: Request) => {
  try {
    const [supabase, raw] = await Promise.all([
      createSupabaseServerClient(),
      req.json().catch(() => null),
    ]);

    const parsed = VaultUnlockSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const dek = Buffer.from(parsed.data.derivedKey, 'base64');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AppError('UNAUTHORIZED', 'Unauthorized');
    }

    const { data: profile } = await supabase
      .from('users_profile')
      .select('vault_check')
      .eq('id', user.id)
      .single();

    if (profile?.vault_check) {
      try {
        const decrypted = await decryptPayload(profile.vault_check, dek);
        if (decrypted !== VAULT_CANARY) {
          throw new AppError('VAULT_REJECTED', 'Incorrect PIN');
        }
      } catch (err) {
        if (err instanceof DecryptionError) {
          throw new AppError('VAULT_REJECTED', 'Incorrect PIN');
        }
        throw err;
      }
    } else {
      const encryptedCanary = await encryptPayload(VAULT_CANARY, dek);
      const { error: upsertError } = await supabase
        .from('users_profile')
        .upsert({
          id: user.id,
          email: user.email ?? '',
          vault_check: encryptedCanary,
        });

      if (upsertError) {
        logger.error(
          { code: upsertError.code, details: upsertError.details },
          'failed to store vault canary'
        );
        throw new AppError('INTERNAL', 'Failed to initialize vault');
      }
    }

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
    return handleApiError('api.vault.unlock', error);
  }
});
