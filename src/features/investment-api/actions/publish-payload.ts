import 'server-only';

import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { seal } from '@/lib/sealed-box';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const MAX_MONEY = 1_000_000_000;

export const weeklyBudgetSchema = z.number().min(0).max(MAX_MONEY);
export const weeklyBudgetInputSchema = z.strictObject({
  weeklyBudget: weeklyBudgetSchema,
});
export const publishInputSchema = z.strictObject({
  surplus: z.number().min(-MAX_MONEY).max(MAX_MONEY),
});

// What is encrypted at rest in invest_settings.payload.
const storedBudgetSchema = z.strictObject({
  weekly_budget: weeklyBudgetSchema,
});
const settingsRowsSchema = z.array(z.object({ payload: z.string().min(1) }));

// What callers open from the sealed summary.
const summaryPlaintextSchema = z.strictObject({
  surplus: z.number().min(-MAX_MONEY).max(MAX_MONEY),
  weekly_budget: weeklyBudgetSchema,
  currency: z.literal('SGD'),
  as_of: z.iso.date(),
});

const CALLER_ROWS = z.array(
  z.object({
    id: z.uuid(),
    x25519_public_key: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
    scopes: z.array(z.string()),
    revoked_at: z.string().nullable(),
  })
);

export function unavailable(): never {
  throw new Error('Investment settings unavailable');
}

export function encodeBudget(weeklyBudget: number, dek: Buffer): string {
  return encryptPayload(
    JSON.stringify(storedBudgetSchema.parse({ weekly_budget: weeklyBudget })),
    dek
  );
}

export function decodeBudget(payload: string, dek: Buffer): number {
  try {
    return storedBudgetSchema.parse(JSON.parse(decryptPayload(payload, dek)))
      .weekly_budget;
  } catch {
    return unavailable();
  }
}

/** Null when the user has not set a budget yet. */
export async function readWeeklyBudget(
  supabase: SupabaseClient,
  userId: string,
  dek: Buffer
): Promise<number | null> {
  const { data, error } = await supabase
    .from('invest_settings')
    .select('payload')
    .eq('user_id', userId);
  if (error) return unavailable();
  const rows = settingsRowsSchema.safeParse(data);
  if (!rows.success) return unavailable();
  const row = rows.data[0];
  return row ? decodeBudget(row.payload, dek) : null;
}

export function buildSummaryPlaintext(
  surplus: number,
  weeklyBudget: number,
  now: Date
): string {
  return JSON.stringify(
    summaryPlaintextSchema.parse({
      surplus,
      weekly_budget: weeklyBudget,
      currency: 'SGD',
      as_of: now.toISOString().slice(0, 10),
    })
  );
}

export type SealTarget = { callerId: string; sealed: string };

/** Revoked callers and callers without summary:read never receive a summary. */
export function sealForEligibleCallers(
  callerRows: unknown,
  plaintext: string
): SealTarget[] {
  const parsed = CALLER_ROWS.safeParse(callerRows);
  if (!parsed.success) return unavailable();
  return parsed.data
    .filter((c) => c.revoked_at === null && c.scopes.includes('summary:read'))
    .map((c) => ({
      callerId: c.id,
      sealed: seal(Buffer.from(c.x25519_public_key, 'base64'), plaintext),
    }));
}
