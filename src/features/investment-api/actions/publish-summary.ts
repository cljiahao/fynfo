'use server';

import { publishSummary } from '@/integrations/services/invest-api-rpc';
import { requireActionContext } from '@/lib/action-guard';
import { ensureJournalPrivateKey } from './journal-keys';
import {
  buildSummaryPlaintext,
  publishInputSchema,
  readWeeklyBudget,
  sealForEligibleCallers,
  unavailable,
} from './publish-payload';

/**
 * The surplus is computed in the browser (the expense override is per-browser) and only
 * validated here; the user id comes from the session. Returns how many callers received a
 * fresh summary; 0 when no weekly budget is set yet.
 */
export async function publishInvestmentSummary(
  input: unknown
): Promise<{ published: number }> {
  const { userId, dek, supabase } = await requireActionContext();
  const parsed = publishInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();

  // Callers fetch the journal public key before they can append, so the keypair must exist
  // as soon as the user starts publishing.
  await ensureJournalPrivateKey(supabase, userId, dek);

  const weeklyBudget = await readWeeklyBudget(supabase, userId, dek);
  if (weeklyBudget === null) return { published: 0 };

  const { data, error } = await supabase
    .from('invest_api_callers')
    .select('id, x25519_public_key, scopes, revoked_at')
    .eq('user_id', userId);
  if (error) return unavailable();

  const targets = sealForEligibleCallers(
    data,
    buildSummaryPlaintext(parsed.data.surplus, weeklyBudget, new Date())
  );
  const results = await Promise.allSettled(
    targets.map((t) => publishSummary(userId, t.callerId, t.sealed))
  );
  const published = results.filter((r) => r.status === 'fulfilled').length;
  // One caller's failure must not block the others; only a total failure is an error.
  if (targets.length > 0 && published === 0) return unavailable();
  return { published };
}
