import {
  finishVaultUnlock,
  reserveVaultUnlock,
} from '@/integrations/services/security-rpc';
import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { sealCookie } from '@/lib/cookie-seal';
import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/utils/with-logging';
import {
  VAULT_COOKIE_BASE_OPTS,
  VAULT_COOKIE_MAX_AGE,
  VAULT_DEK_COOKIE,
} from '@/lib/vault-cookie';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const VAULT_CANARY = 'fynfo_vault_ok';

const base64Dek = z
  .string()
  .length(44)
  .refine(
    (v) => {
      try {
        const decoded = Buffer.from(v, 'base64');
        return decoded.length === 32 && decoded.toString('base64') === v;
      } catch {
        return false;
      }
    },
    { message: 'derived key must be base64-encoded 32-byte value' }
  );

const VaultUnlockSchema = z.object({
  derivedKey: base64Dek,
});

const COOKIE_OPTS = {
  ...VAULT_COOKIE_BASE_OPTS,
  maxAge: VAULT_COOKIE_MAX_AGE,
};

// Constant-time string compare on equal-length buffers (defense-in-depth;
// GCM already authenticates the canary).
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function verifyCanary(ciphertext: string, dek: Buffer): Promise<void> {
  try {
    const decrypted = decryptPayload(ciphertext, dek);
    if (!safeEqual(decrypted, VAULT_CANARY)) {
      throw new AppError('VAULT_REJECTED', 'Incorrect PIN');
    }
  } catch (err) {
    if (err instanceof DecryptionError) {
      throw new AppError('VAULT_REJECTED', 'Incorrect PIN');
    }
    throw err;
  }
}

const TOO_MANY = { error: 'Too many attempts. Try again later.' };

export const GET = withLogging('api.vault.status', async () => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new AppError('UNAUTHORIZED', 'Unauthorized');
    }
    const { data: profile, error } = await supabase
      .from('users_profile')
      .select('vault_check_v2')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      logger.error({ code: error.code }, 'failed to read vault status');
      throw new AppError('INTERNAL', 'Vault unavailable');
    }
    return NextResponse.json(
      { initialized: Boolean(profile?.vault_check_v2) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    const response = handleApiError('api.vault.status', error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
});

export const DELETE = withLogging('api.vault.reset', async () => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AppError('UNAUTHORIZED', 'Unauthorized');
    }

    const { error } = await supabase
      .from('users_profile')
      .update({ vault_check_v2: null, vault_version: 1 })
      .eq('id', user.id);

    if (error) {
      logger.error({ code: error.code }, 'failed to reset vault');
      throw new AppError('INTERNAL', 'Failed to reset vault');
    }

    const cookieStore = await cookies();
    cookieStore.delete(VAULT_DEK_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.reset', error);
  }
});

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

    // Reserve before verification so concurrent guesses share the same budget.
    const [{ data: profile, error: profileError }, attemptId] =
      await Promise.all([
        supabase
          .from('users_profile')
          .select('vault_check_v2')
          .eq('id', user.id)
          .maybeSingle(),
        reserveVaultUnlock(user.id),
      ]);

    // Fail closed: a read error must never fall through to first-unlock, which
    // would re-init the vault with a fresh canary and orphan existing data.
    if (profileError) {
      logger.error({ code: profileError.code }, 'failed to read vault profile');
      throw new AppError('INTERNAL', 'Vault unavailable');
    }

    if (!attemptId) return NextResponse.json(TOO_MANY, { status: 429 });

    let canary = profile?.vault_check_v2;
    if (!canary) {
      // Conflict-ignore preserves profile metadata; the null predicate admits
      // only one initializer even when several requests read the same null.
      const { error: insertError } = await supabase
        .from('users_profile')
        .upsert(
          {
            id: user.id,
            email: user.email ?? '',
            vault_check_v2: null,
            vault_version: 1,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      if (insertError) {
        logger.error(
          { code: insertError.code },
          'failed to create vault profile'
        );
        throw new AppError('INTERNAL', 'Failed to initialize vault');
      }
      const { error: updateError } = await supabase
        .from('users_profile')
        .update({
          vault_check_v2: encryptPayload(VAULT_CANARY, dek),
          vault_version: 2,
        })
        .eq('id', user.id)
        .is('vault_check_v2', null);
      if (updateError) {
        logger.error(
          { code: updateError.code },
          'failed to store vault canary'
        );
        throw new AppError('INTERNAL', 'Failed to initialize vault');
      }
      const { data: winner, error: winnerError } = await supabase
        .from('users_profile')
        .select('vault_check_v2')
        .eq('id', user.id)
        .maybeSingle();
      if (winnerError || !winner?.vault_check_v2) {
        logger.error(
          { code: winnerError?.code },
          'failed to read initialized vault'
        );
        throw new AppError('INTERNAL', 'Vault unavailable');
      }
      canary = winner.vault_check_v2;
    }

    try {
      await verifyCanary(canary, dek);
    } catch (err) {
      if (err instanceof AppError && err.code === 'VAULT_REJECTED') {
        const nowLocked = await finishVaultUnlock(user.id, attemptId, false);
        return nowLocked
          ? NextResponse.json(TOO_MANY, { status: 429 })
          : NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
      }
      throw err;
    }

    await finishVaultUnlock(user.id, attemptId, true);
    const cookieStore = await cookies();
    cookieStore.set(
      VAULT_DEK_COOKIE,
      sealCookie(dek.toString('base64'), user.id, 'vault-dek'),
      COOKIE_OPTS
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.unlock', error);
  }
});
