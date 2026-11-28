import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// EXECUTE on every one of these is granted to service_role only (migration
// 20261128000204_invest_api.sql), so this file is the single place that holds that credential
// for the investment API.
type InvestApiRpc =
  | 'invest_api_authenticate'
  | 'invest_api_consume_nonce'
  | 'invest_api_get_summary'
  | 'invest_api_get_journal_public_key'
  | 'invest_api_append_journal'
  | 'invest_api_journal_meta'
  | 'invest_api_audit_write'
  | 'invest_api_publish_summary'
  | 'invest_api_prune';

type RpcParameters = Record<string, string | number | null>;

const SCOPE = z.enum([
  'summary:read',
  'journal:meta',
  'journal:append:plan',
  'journal:append:sell_flag',
  'journal:append:verdict',
]);
const AUTHENTICATED_ROWS = z.array(
  z.object({
    caller_id: z.uuid(),
    user_id: z.uuid(),
    caller_name: z.string(),
    public_key: z.string(),
    scopes: z.array(SCOPE),
  })
);
const SUMMARY_ROWS = z.array(
  z.object({ sealed: z.string(), published_at: z.string() })
);
const META_ROWS = z.array(
  z.object({
    id: z.uuid(),
    caller: z.string(),
    event_type: z.enum(['plan', 'sell_flag', 'verdict']),
    created_at: z.string(),
  })
);

export type InvestScope = z.infer<typeof SCOPE>;
export type InvestEventType = 'plan' | 'sell_flag' | 'verdict';
export type AuthenticatedKey = {
  callerId: string;
  userId: string;
  callerName: string;
  publicKey: string;
  scopes: InvestScope[];
};

function unavailable(): never {
  throw new Error('Investment API service unavailable');
}

async function callRpc(
  name: InvestApiRpc,
  parameters: RpcParameters
): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) unavailable();
  try {
    // This credential bypasses RLS; keep the raw client private to this module.
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

/** Null for an unknown, expired or revoked key so callers map it to the one generic 401. */
export async function authenticateKey(
  keyId: string
): Promise<AuthenticatedKey | null> {
  const rows = parseResult(
    AUTHENTICATED_ROWS,
    await callRpc('invest_api_authenticate', { p_key_id: keyId })
  );
  const row = rows[0];
  if (!row) return null;
  return {
    callerId: row.caller_id,
    userId: row.user_id,
    callerName: row.caller_name,
    publicKey: row.public_key,
    scopes: row.scopes,
  };
}

/** False when the signature hash was already used. */
export async function consumeNonce(
  signatureHash: string,
  expiresAt: Date
): Promise<boolean> {
  return parseResult(
    z.boolean(),
    await callRpc('invest_api_consume_nonce', {
      p_hash: signatureHash,
      p_expires_at: expiresAt.toISOString(),
    })
  );
}

export async function getSealedSummary(
  callerId: string
): Promise<{ sealed: string; publishedAt: string } | null> {
  const row = parseResult(
    SUMMARY_ROWS,
    await callRpc('invest_api_get_summary', { p_caller_id: callerId })
  )[0];
  return row ? { sealed: row.sealed, publishedAt: row.published_at } : null;
}

export async function getJournalPublicKey(
  callerId: string
): Promise<string | null> {
  return parseResult(
    z.string().nullable(),
    await callRpc('invest_api_get_journal_public_key', {
      p_caller_id: callerId,
    })
  );
}

export async function appendJournal(
  callerId: string,
  eventType: InvestEventType,
  occurredAt: Date,
  sealed: string
): Promise<string> {
  return parseResult(
    z.uuid(),
    await callRpc('invest_api_append_journal', {
      p_caller_id: callerId,
      p_event_type: eventType,
      p_occurred_at: occurredAt.toISOString(),
      p_sealed: sealed,
    })
  );
}

export async function listJournalMeta(
  userId: string,
  since: Date | null
): Promise<z.infer<typeof META_ROWS>> {
  return parseResult(
    META_ROWS,
    await callRpc('invest_api_journal_meta', {
      p_user_id: userId,
      p_since: since ? since.toISOString() : null,
    })
  );
}

export async function writeAudit(
  callerId: string | null,
  keyId: string | null,
  endpoint: string,
  status: number
): Promise<void> {
  await callRpc('invest_api_audit_write', {
    p_caller_id: callerId,
    p_key_id: keyId,
    p_endpoint: endpoint,
    p_status: status,
  });
}

export async function publishSummary(
  userId: string,
  callerId: string,
  sealed: string
): Promise<void> {
  await callRpc('invest_api_publish_summary', {
    p_user_id: userId,
    p_caller_id: callerId,
    p_sealed: sealed,
  });
}

export async function pruneInvestApi(): Promise<void> {
  await callRpc('invest_api_prune', {});
}
