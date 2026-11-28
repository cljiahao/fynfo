import 'server-only';

import { setJournalKey } from '@/integrations/services/invest-api-rpc';
import {
  generateJournalKeyPair,
  unwrapJournalPrivateKey,
  wrapJournalPrivateKey,
} from '@/lib/sealed-box';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const KEY_ROWS = z.array(z.object({ wrapped_private_key: z.string().min(1) }));

async function readWrapped(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('invest_journal_keys')
    .select('wrapped_private_key')
    .eq('user_id', userId);
  if (error) throw new Error('Journal key unavailable');
  const rows = KEY_ROWS.safeParse(data);
  if (!rows.success) throw new Error('Journal key unavailable');
  return rows.data[0]?.wrapped_private_key ?? null;
}

/**
 * Returns the unwrapped journal private key, creating the keypair on first use. The RPC never
 * overwrites, so a concurrent creator loses the race and both sides read the winner's row.
 */
export async function ensureJournalPrivateKey(
  supabase: SupabaseClient,
  userId: string,
  dek: Buffer
): Promise<Buffer> {
  let wrapped = await readWrapped(supabase, userId);
  if (!wrapped) {
    const pair = generateJournalKeyPair();
    await setJournalKey(
      userId,
      pair.publicKey.toString('base64'),
      wrapJournalPrivateKey(pair.privateKey, dek)
    );
    wrapped = await readWrapped(supabase, userId);
    if (!wrapped) throw new Error('Journal key unavailable');
  }
  return unwrapJournalPrivateKey(wrapped, dek);
}
