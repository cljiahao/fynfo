'use server';

import { requireActionContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { z } from 'zod';
import { MERCHANT_RULE_LIMITS } from '../constants';
import {
  merchantRulebookPayloadSchema,
  rulebookRevisionSchema,
  saveRulebookSchema,
} from '../schemas';
import type { MerchantRulebook, SaveRulebookOutcome } from '../types';

const stored = z.strictObject({
  id: z.uuid(),
  revision: rulebookRevisionSchema,
  payload: z.string().min(1).max(MERCHANT_RULE_LIMITS.ciphertextBytes),
});

export async function getMerchantRulebook(): Promise<MerchantRulebook | null> {
  const { userId, dek, supabase } = await requireActionContext();
  const { data, error } = await supabase
    .from('personal_merchant_rulebooks')
    .select('id,revision::text,payload')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'merchant rule read');
  if (data === null) return null;
  try {
    const row = stored.parse(data);
    const plaintext = decryptPayload(row.payload, dek);
    if (
      Buffer.byteLength(plaintext, 'utf8') > MERCHANT_RULE_LIMITS.payloadBytes
    )
      throw new Error();
    return {
      id: row.id,
      revision: row.revision,
      payload: merchantRulebookPayloadSchema.parse(JSON.parse(plaintext)),
    };
  } catch {
    throw new AppError(
      'VALIDATION',
      'Merchant rules could not be read. Try loading again.'
    );
  }
}

export async function saveMerchantRulebook(
  input: unknown
): Promise<SaveRulebookOutcome> {
  const parsed = saveRulebookSchema.safeParse(input);
  if (!parsed.success) return { status: 'not_saved' };
  let sent = false;
  try {
    const { dek, supabase } = await requireActionContext();
    const value = parsed.data;
    const ciphertext = encryptPayload(JSON.stringify(value.payload), dek);
    if (
      Buffer.byteLength(ciphertext, 'utf8') >
      MERCHANT_RULE_LIMITS.ciphertextBytes
    )
      return { status: 'not_saved' };
    sent = true;
    const { data, error } = await supabase.rpc(
      'compare_save_personal_merchant_rulebook',
      {
        p_id: value.id,
        p_expected_revision: value.expectedRevision,
        p_payload: ciphertext,
      }
    );
    if (error) return { status: 'unconfirmed' };
    const result = z
      .array(
        z.strictObject({
          status: z.enum(['SAVED', 'CONFLICT']),
          revision: rulebookRevisionSchema.nullable(),
        })
      )
      .length(1)
      .safeParse(data);
    if (!result.success) return { status: 'unconfirmed' };
    const row = result.data[0];
    if (row.status === 'CONFLICT') return { status: 'conflict' };
    if (row.revision !== String(BigInt(value.expectedRevision) + BigInt(1)))
      return { status: 'unconfirmed' };
    return { status: 'saved', revision: row.revision };
  } catch {
    return { status: sent ? 'unconfirmed' : 'not_saved' };
  }
}
