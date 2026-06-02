import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { sealCookie } from '@/lib/cookie-seal';
import { DecryptionError, decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, handleApiError } from '@/lib/errors';
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

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 6,
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
    const decrypted = await decryptPayload(ciphertext, dek);
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

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Throttle helpers fail OPEN: if the rate-limit RPCs are not deployed yet
// (migration not applied), log and allow, so unlock is never bricked.
async function isUnlockLocked(supabase: ServerClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('vault_unlock_locked');
  if (error) {
    logger.warn({ code: error.code }, 'vault unlock rate-limit unavailable');
    return false;
  }
  return data === true;
}

async function recordUnlockAttempt(
  supabase: ServerClient,
  success: boolean
): Promise<boolean> {
  const { data, error } = await supabase.rpc('vault_unlock_record', {
    p_success: success,
  });
  if (error) {
    logger.warn({ code: error.code }, 'vault unlock rate-limit unavailable');
    return false;
  }
  return data === true;
}

const TOO_MANY = { error: 'Too many attempts. Try again later.' };

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

    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('vault_check_v2')
      .eq('id', user.id)
      .maybeSingle();

    // Fail closed: a read error must never fall through to first-unlock, which
    // would re-init the vault with a fresh canary and orphan existing data.
    if (profileError) {
      logger.error({ code: profileError.code }, 'failed to read vault profile');
      throw new AppError('INTERNAL', 'Vault unavailable');
    }

    // Returning user: verify canary against existing v2 vault, rate-limited.
    if (profile?.vault_check_v2) {
      if (await isUnlockLocked(supabase)) {
        return NextResponse.json(TOO_MANY, { status: 429 });
      }

      try {
        await verifyCanary(profile.vault_check_v2, dek);
      } catch (err) {
        if (err instanceof AppError && err.code === 'VAULT_REJECTED') {
          const nowLocked = await recordUnlockAttempt(supabase, false);
          return nowLocked
            ? NextResponse.json(TOO_MANY, { status: 429 })
            : NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
        }
        throw err;
      }

      await recordUnlockAttempt(supabase, true);
      const cookieStore = await cookies();
      cookieStore.set(
        'fynfo_vault_dek',
        sealCookie(dek.toString('base64')),
        COOKIE_OPTS
      );
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
    cookieStore.set(
      'fynfo_vault_dek',
      sealCookie(dek.toString('base64')),
      COOKIE_OPTS
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.unlock', error);
  }
});
