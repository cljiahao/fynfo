'use server';

import { requireActionContext, requireDbContext } from '@/lib/action-guard';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import {
  deriveInviteKey,
  generateInviteSecret,
  generateKh,
  hashInviteCode,
  unwrapKh,
  wrapKh,
} from '@/lib/household-key';
import {
  getHouseholdKhSession,
  setHouseholdKhSession,
} from '@/lib/household-keystore';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { INVITE_TTL_HOURS } from '../constants';
import { acceptInviteSchema, createHouseholdSchema } from '../schemas';
import type {
  AcceptInviteResult,
  CreateHouseholdResult,
  HouseholdRole,
  HouseholdSummary,
  InviteResult,
} from '../types';

interface OwnMemberRow {
  household_id: string;
  role: HouseholdRole;
  wrapped_kh: string;
}

async function readOwnMember(
  supabase: Awaited<ReturnType<typeof requireDbContext>>['supabase'],
  userId: string
): Promise<OwnMemberRow | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, role, wrapped_kh')
    .eq('user_id', userId);
  throwIfSupabaseError(error, 'household member read');
  const rows = (data ?? []) as OwnMemberRow[];
  return rows[0] ?? null;
}

/** Creates a household, generates K_h, wraps it for the owner, opens the session. */
export async function createHousehold(
  input: unknown
): Promise<CreateHouseholdResult> {
  const { name } = parseOrThrow(
    createHouseholdSchema,
    input,
    'household.create.input'
  );
  const { userId, dek, supabase } = await requireActionContext();

  const householdId = randomUUID();
  const kh = generateKh();

  const { error: hError } = await supabase
    .from('households')
    .insert({ id: householdId, name, created_by: userId });
  throwIfSupabaseError(hError, 'household create');

  const { error: mError } = await supabase.from('household_members').insert({
    household_id: householdId,
    user_id: userId,
    role: 'owner',
    wrapped_kh: wrapKh(kh, dek),
  });
  throwIfSupabaseError(mError, 'household member create');

  await setHouseholdKhSession(kh, userId);
  return { householdId };
}

/** Returns the caller's household summary, or null if they are not in one. */
export async function getHousehold(): Promise<HouseholdSummary | null> {
  const { userId, supabase } = await requireDbContext();

  const { data, error } = await supabase
    .from('household_members')
    .select('role, households(id, name, created_at)')
    .eq('user_id', userId);
  throwIfSupabaseError(error, 'household read');

  const row = (data ?? [])[0] as unknown as
    | {
        role: HouseholdRole;
        households: { id: string; name: string; created_at: string } | null;
      }
    | undefined;
  if (!row?.households) return null;

  // Lock state from the session key (cookie check, no DEK needed) — so the page
  // distinguishes "locked" from a genuine read error instead of inferring it.
  const kh = await getHouseholdKhSession(userId);

  return {
    id: row.households.id,
    name: row.households.name,
    role: row.role,
    createdAt: row.households.created_at,
    locked: kh === null,
  };
}

/** Unwraps K_h with the caller's personal DEK and opens the household session. */
export async function unlockHousehold(): Promise<{ ok: true }> {
  const { userId, dek, supabase } = await requireActionContext();

  const member = await readOwnMember(supabase, userId);
  if (!member) throw new AppError('NOT_FOUND', 'No household to unlock');

  const kh = unwrapKh(member.wrapped_kh, dek);
  await setHouseholdKhSession(kh, userId);
  return { ok: true };
}

/** Owner mints a one-time invite carrying K_h wrapped under a secret-derived key. */
export async function createInvite(): Promise<InviteResult> {
  const { userId, dek, supabase } = await requireActionContext();

  const member = await readOwnMember(supabase, userId);
  if (!member || member.role !== 'owner') {
    throw new AppError('UNAUTHORIZED', 'Only the household owner can invite');
  }

  const kh = unwrapKh(member.wrapped_kh, dek);
  const { secret, saltB64 } = generateInviteSecret();
  const inviteKey = await deriveInviteKey(secret, saltB64);

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabase.from('household_invites').insert({
    household_id: member.household_id,
    invite_code_hash: hashInviteCode(secret),
    kdf_salt: saltB64,
    wrapped_kh_under_invite: wrapKh(kh, inviteKey),
    created_by: userId,
    expires_at: expiresAt,
  });
  throwIfSupabaseError(error, 'household invite create');

  return { secret };
}

/** Second member accepts: re-wraps K_h under their own DEK, consumes the invite. */
export async function acceptInvite(
  input: unknown
): Promise<AcceptInviteResult> {
  const { secret } = parseOrThrow(
    acceptInviteSchema,
    input,
    'household.accept.input'
  );
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase.rpc('accept_household_invite', {
    p_code_hash: hashInviteCode(secret),
  });
  throwIfSupabaseError(error, 'household invite accept');

  const invite = (data ?? [])[0] as
    | { invite_id: string; wrapped_kh_under_invite: string; kdf_salt: string }
    | undefined;
  if (!invite) throw new AppError('NOT_FOUND', 'Invite not valid');

  let kh: Buffer;
  try {
    const inviteKey = await deriveInviteKey(secret, invite.kdf_salt);
    kh = unwrapKh(invite.wrapped_kh_under_invite, inviteKey);
  } catch {
    throw new AppError('VALIDATION', 'Invite not valid');
  }

  const { data: householdId, error: consumeError } = await supabase.rpc(
    'consume_household_invite',
    {
      p_invite_id: invite.invite_id,
      p_user_id: userId,
      p_wrapped_kh: wrapKh(kh, dek),
      p_code_hash: hashInviteCode(secret),
    }
  );
  throwIfSupabaseError(consumeError, 'household invite consume');

  await setHouseholdKhSession(kh, userId);
  return { householdId: householdId as string };
}
