import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, handleApiError } from '@/lib/errors';
import { getSessionSecret } from '@/lib/keystore';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/utils/with-logging';
import { rekeyUserVault } from '@/lib/vault-rekey/rekey';
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
  derivedKeyV2: base64Dek,
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

    const dekV1 = Buffer.from(parsed.data.derivedKey, 'base64');
    const dekV2 = Buffer.from(parsed.data.derivedKeyV2, 'base64');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AppError('UNAUTHORIZED', 'Unauthorized');
    }

    const { data: profile } = await supabase
      .from('users_profile')
      .select('vault_check, vault_check_v2, vault_version')
      .eq('id', user.id)
      .single();

    // Case A: v2 vault — verify v2 canary, no rekey.
    if (profile?.vault_check_v2) {
      await verifyCanary(profile.vault_check_v2, dekV2);
      const cookieStore = await cookies();
      cookieStore.set('fynfo_vault_dek', cookieBlob(dekV2), COOKIE_OPTS);
      return NextResponse.json({ success: true });
    }

    // Case B: legacy v1 vault — verify v1 canary, then rekey to v2.
    if (profile?.vault_check) {
      await verifyCanary(profile.vault_check, dekV1);
      await rekeyUserVault(supabase, user.id, dekV1, dekV2);
      const cookieStore = await cookies();
      cookieStore.set('fynfo_vault_dek', cookieBlob(dekV2), COOKIE_OPTS);
      logger.info({ userId: user.id }, 'vault unlock rekeyed v1 -> v2');
      return NextResponse.json({ success: true, rekeyed: true });
    }

    // Case C: first unlock — write v2 canary, mark version 2.
    const encryptedCanary = await encryptPayload(VAULT_CANARY, dekV2);
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
    cookieStore.set('fynfo_vault_dek', cookieBlob(dekV2), COOKIE_OPTS);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.unlock', error);
  }
});
