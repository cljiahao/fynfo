import 'server-only';

import type { MarketingEventType } from '@/lib/constants/telemetry';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

type SecurityRpc =
  | 'reserve_vault_unlock'
  | 'finish_vault_unlock'
  | 'record_marketing_event'
  | 'get_marketing_event_stats'
  | 'get_signup_stats';

const COUNT_SCHEMA = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .pipe(
    z.coerce
      .number<string | number>()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
  );
const EVENT_ROWS = z.array(
  z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    event_type: z.string(),
    events: COUNT_SCHEMA,
  })
);
const SIGNUP_ROWS = z.array(
  z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    signups: COUNT_SCHEMA,
  })
);

function unavailable(): never {
  throw new Error('Security service unavailable');
}

async function callSecurityRpc(
  name: SecurityRpc,
  parameters?: Record<string, string | boolean>
): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) unavailable();
  try {
    // This credential bypasses RLS. Keep the raw client private and all financial
    // queries on the separate user-session client (spec071).
    const client = createClient(url, secret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
              : AbortSignal.timeout(10_000),
          }),
      },
    });
    const { data, error } = await client.rpc(name, parameters);
    if (error) unavailable();
    return data;
  } catch {
    unavailable();
  }
}

function parseResult<T>(schema: z.ZodType<T>, result: unknown): T {
  const parsed = schema.safeParse(result);
  if (!parsed.success) unavailable();
  return parsed.data;
}

export async function reserveVaultUnlock(
  userId: string
): Promise<string | null> {
  return parseResult(
    z.uuid().nullable(),
    await callSecurityRpc('reserve_vault_unlock', { p_user_id: userId })
  );
}

export async function finishVaultUnlock(
  userId: string,
  attemptId: string,
  success: boolean
): Promise<boolean> {
  return parseResult(
    z.boolean(),
    await callSecurityRpc('finish_vault_unlock', {
      p_user_id: userId,
      p_attempt_id: attemptId,
      p_success: success,
    })
  );
}

export async function recordMarketingEvent(
  eventType: MarketingEventType,
  path: string
): Promise<void> {
  await callSecurityRpc('record_marketing_event', {
    p_event_type: eventType,
    p_path: path,
  });
}

export async function readMarketingAggregates() {
  const [events, signups] = await Promise.all([
    callSecurityRpc('get_marketing_event_stats'),
    callSecurityRpc('get_signup_stats'),
  ]);
  return {
    events: parseResult(EVENT_ROWS, events ?? []),
    signups: parseResult(SIGNUP_ROWS, signups ?? []),
  };
}
