'use server';

import {
  addKey,
  createCaller,
  revokeCaller,
  revokeKey,
  setCallerPublicKey,
} from '@/integrations/services/invest-api-rpc';
import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { getVaultDekSession } from '@/lib/keystore';
import { logger } from '@/lib/logger';
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import {
  CALLER_PRESETS,
  addKeyInputSchema,
  createCallerInputSchema,
  isKeyActive,
  revokeCallerInputSchema,
  revokeKeyInputSchema,
  setSealingKeyInputSchema,
  type CallerActionResult,
  type CallerKey,
  type CallerPreset,
  type CallerSummary,
} from '../schemas/callers-schemas';

const GENERIC_FAILURE = 'Something went wrong. Please try again.';
const INVALID_INPUT = 'Check the highlighted fields and try again.';
const MAX_ACTIVE_KEYS = 2;

// Constitution §2.3: identity first, then the vault session, before any DB access.
async function requireOwner(): Promise<string> {
  const userId = await requireUserId();
  const dek = await getVaultDekSession(userId);
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return userId;
}

function parse<S extends z.ZodType>(
  schema: S,
  input: unknown
): z.infer<S> | null {
  const result = schema.safeParse(input);
  return result.success ? result.data : null;
}

function fail(label: string, error: unknown): { ok: false; message: string } {
  logger.error({ label, err: error }, 'investment api caller action failed');
  return { ok: false, message: GENERIC_FAILURE };
}

function fingerprint(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('hex').slice(0, 8);
}

function presetFor(scopes: string[]): CallerPreset | null {
  const sorted = [...scopes].sort().join(',');
  for (const [name, presetScopes] of Object.entries(CALLER_PRESETS)) {
    if ([...presetScopes].sort().join(',') === sorted) {
      return name as CallerPreset;
    }
  }
  return null;
}

type CallerRow = {
  id: string;
  name: string;
  scopes: string[];
  x25519_public_key: string;
  created_at: string;
  revoked_at: string | null;
  invest_api_keys: {
    id: string;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
  }[];
};

export async function listCallers(): Promise<CallerSummary[]> {
  const userId = await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('invest_api_callers')
    .select(
      'id, name, scopes, x25519_public_key, created_at, revoked_at, invest_api_keys(id, created_at, expires_at, revoked_at)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.error({ err: error }, 'investment api caller list failed');
    throw new Error('Could not load API callers');
  }
  return ((data ?? []) as CallerRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    preset: presetFor(row.scopes),
    scopes: row.scopes,
    sealingFingerprint: fingerprint(row.x25519_public_key),
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    keys: row.invest_api_keys
      .map(
        (key): CallerKey => ({
          id: key.id,
          createdAt: key.created_at,
          expiresAt: key.expires_at,
          revokedAt: key.revoked_at,
        })
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}

export async function createCallerAction(
  input: unknown
): Promise<CallerActionResult<{ callerId: string; keyId: string }>> {
  const userId = await requireOwner();
  const data = parse(createCallerInputSchema, input);
  if (!data) return { ok: false, message: INVALID_INPUT };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: existing, error } = await supabase
      .from('invest_api_callers')
      .select('id')
      .eq('user_id', userId)
      .eq('name', data.name)
      .limit(1);
    if (error) return fail('create.precheck', error);
    if (existing && existing.length > 0) {
      return { ok: false, message: 'That caller name is already used.' };
    }

    const callerId = await createCaller(
      userId,
      data.name,
      [...CALLER_PRESETS[data.preset]],
      data.sealingPublicKey
    );
    try {
      const key = await addKey(userId, callerId, data.signingPublicKey);
      return { ok: true, callerId, keyId: key.keyId };
    } catch (error) {
      logger.error({ err: error }, 'investment api first key failed');
      return {
        ok: false,
        message:
          'The caller was created but its signing key was not registered. Add a key from the list.',
      };
    }
  } catch (error) {
    return fail('create', error);
  }
}

export async function addKeyAction(
  input: unknown
): Promise<CallerActionResult<{ keyId: string; expiresAt: string }>> {
  const userId = await requireOwner();
  const data = parse(addKeyInputSchema, input);
  if (!data) return { ok: false, message: INVALID_INPUT };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: keys, error } = await supabase
      .from('invest_api_keys')
      .select('id, created_at, expires_at, revoked_at')
      .eq('caller_id', data.callerId);
    if (error) return fail('addKey.precheck', error);
    const now = Date.now();
    const active = (keys ?? []).filter((key) =>
      isKeyActive(
        {
          id: key.id,
          createdAt: key.created_at,
          expiresAt: key.expires_at,
          revokedAt: key.revoked_at,
        },
        now
      )
    );
    if (active.length >= MAX_ACTIVE_KEYS) {
      return {
        ok: false,
        message:
          'Two keys are already active. Revoke one before adding another.',
      };
    }
    const key = await addKey(userId, data.callerId, data.signingPublicKey);
    return { ok: true, keyId: key.keyId, expiresAt: key.expiresAt };
  } catch (error) {
    return fail('addKey', error);
  }
}

export async function revokeKeyAction(
  input: unknown
): Promise<CallerActionResult> {
  const userId = await requireOwner();
  const data = parse(revokeKeyInputSchema, input);
  if (!data) return { ok: false, message: INVALID_INPUT };
  try {
    const revoked = await revokeKey(userId, data.keyId);
    return revoked
      ? { ok: true }
      : { ok: false, message: 'That key is already revoked or not found.' };
  } catch (error) {
    return fail('revokeKey', error);
  }
}

export async function revokeCallerAction(
  input: unknown
): Promise<CallerActionResult> {
  const userId = await requireOwner();
  const data = parse(revokeCallerInputSchema, input);
  if (!data) return { ok: false, message: INVALID_INPUT };
  try {
    const revoked = await revokeCaller(userId, data.callerId);
    return revoked
      ? { ok: true }
      : { ok: false, message: 'That caller is already revoked or not found.' };
  } catch (error) {
    return fail('revokeCaller', error);
  }
}

export async function setSealingKeyAction(
  input: unknown
): Promise<CallerActionResult> {
  const userId = await requireOwner();
  const data = parse(setSealingKeyInputSchema, input);
  if (!data) return { ok: false, message: INVALID_INPUT };
  try {
    const updated = await setCallerPublicKey(
      userId,
      data.callerId,
      data.sealingPublicKey
    );
    return updated
      ? { ok: true }
      : { ok: false, message: 'That caller is revoked or not found.' };
  } catch (error) {
    return fail('setSealingKey', error);
  }
}
