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

const base64Dek = z
  .string()
  .min(1)
  .refine(
    (v) => {
      try {
        return Buffer.from(v, 'base64').length === 32;
      } catch {
        return false;
      }
    },
    { message: 'derived key must be base64-encoded 32-byte value' }
  );

const VaultUnlockSchema = z.object({
  derivedKey: base64Dek,
});

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

function cookieBlob(dek: Buffer): string {
  return Buffer.from(encryptCookiePayload(dek.toString('base64'))).toString(
    'base64'
  );
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 6,
};

async function verifyCanary(ciphertext: string, dek: Buffer): Promise<void> {
  try {
    const decrypted = await decryptPayload(ciphertext, dek);
    if (decrypted !== VAULT_CANARY) {
      throw new AppError('VAULT_REJECTED', 'Incorrect PIN');
    }
  } catch (err) {
    if (err instanceof DecryptionError) {
      throw new AppError('VAULT_REJECTED', 'Incorrect PIN');
    }
    throw err;
  }
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
      .select('vault_check_v2')
      .eq('id', user.id)
      .single();

    // Returning user: verify canary against existing v2 vault.
    if (profile?.vault_check_v2) {
      await verifyCanary(profile.vault_check_v2, dek);
      const cookieStore = await cookies();
      cookieStore.set('fynfo_vault_dek', cookieBlob(dek), COOKIE_OPTS);
      return NextResponse.json({ success: true });
    }

    // First unlock: write v2 canary, mark version 2.
    const encryptedCanary = await encryptPayload(VAULT_CANARY, dek);
    const { error: upsertError } = await supabase.from('users_profile').upsert({
      id: user.id,
      email: user.email ?? '',
      vault_check_v2: encryptedCanary,
      vault_version: 2,
    });

    if (upsertError) {
      logger.error(
        { code: upsertError.code, details: upsertError.details },
        'failed to store vault canary'
      );
      throw new AppError('INTERNAL', 'Failed to initialize vault');
    }

    const cookieStore = await cookies();
    cookieStore.set('fynfo_vault_dek', cookieBlob(dek), COOKIE_OPTS);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.unlock', error);
  }
});
