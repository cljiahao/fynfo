/**
 * TEMPORARY DIAGNOSTIC — spec 002 intermediate-dek-salvage stage 1.
 * Identifies which historical DEK encrypted a given row. Delete after rekey
 * salvage completes.
 */

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { DecryptionError, decryptPayload } from '@/lib/crypto';
import {
  INTERMEDIATE_ITERATIONS,
  INTERMEDIATE_PBKDF2_SALT_PREFIX,
  KEY_LEN_BYTES,
  PBKDF2_DIGEST,
  V1_ITERATIONS,
  V1_PBKDF2_SALT,
  V2_ITERATIONS,
} from '@/lib/crypto-constants';
import { AppError, handleApiError } from '@/lib/errors';
import { withLogging } from '@/lib/utils/with-logging';
import { ENCRYPTED_TABLES } from '@/lib/vault-rekey/manifest';
import { pbkdf2 } from 'crypto';
import { NextResponse } from 'next/server';
import { promisify } from 'util';
import { z } from 'zod';

const pbkdf2Async = promisify(pbkdf2);

const ProbeSchema = z.object({
  rowId: z.string().uuid(),
  pin: z.string().regex(/^\d{6}$/),
});

type Match = 'v1' | 'intermediate' | 'v2' | 'none';

async function tryDecrypt(
  ciphertext: string,
  candidates: { label: Match; dek: Buffer }[]
): Promise<{ matched: Match; plaintext: string | null }> {
  for (const c of candidates) {
    try {
      const plain = await decryptPayload(ciphertext, c.dek);
      return { matched: c.label, plaintext: plain };
    } catch (e) {
      if (e instanceof DecryptionError) continue;
      throw e;
    }
  }
  return { matched: 'none', plaintext: null };
}

export const POST = withLogging('api.vault.probe', async (req: Request) => {
  try {
    const supabase = await createSupabaseServerClient();
    const raw = await req.json().catch(() => null);
    const parsed = ProbeSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new AppError('UNAUTHORIZED', 'Unauthorized');
    }

    const pin = parsed.data.pin;
    const [dekV1, dekIntermediate, dekV2] = await Promise.all([
      pbkdf2Async(
        pin,
        V1_PBKDF2_SALT,
        V1_ITERATIONS,
        KEY_LEN_BYTES,
        PBKDF2_DIGEST
      ),
      pbkdf2Async(
        pin,
        INTERMEDIATE_PBKDF2_SALT_PREFIX + user.id,
        INTERMEDIATE_ITERATIONS,
        KEY_LEN_BYTES,
        PBKDF2_DIGEST
      ),
      pbkdf2Async(pin, user.id, V2_ITERATIONS, KEY_LEN_BYTES, PBKDF2_DIGEST),
    ]);

    const candidates: { label: Match; dek: Buffer }[] = [
      { label: 'v1', dek: dekV1 },
      { label: 'intermediate', dek: dekIntermediate },
      { label: 'v2', dek: dekV2 },
    ];

    for (const t of ENCRYPTED_TABLES) {
      const cols = ['id', ...t.encryptedColumns].join(', ');
      const { data, error } = await supabase
        .from(t.table)
        .select(cols)
        .eq('id', parsed.data.rowId)
        .maybeSingle();
      if (error || !data) continue;

      const results: Record<string, Match> = {};
      for (const col of t.encryptedColumns) {
        const v = (data as unknown as Record<string, string | null>)[col];
        if (v == null) {
          results[col] = 'none';
          continue;
        }
        const { matched } = await tryDecrypt(v, candidates);
        results[col] = matched;
      }
      return NextResponse.json({
        table: t.table,
        rowId: parsed.data.rowId,
        results,
      });
    }

    return NextResponse.json(
      { error: 'row not found in any encrypted table' },
      { status: 404 }
    );
  } catch (error) {
    return handleApiError('api.vault.probe', error);
  }
});
