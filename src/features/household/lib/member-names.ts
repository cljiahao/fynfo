import { decryptPayload, encryptPayload } from '@/lib/crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MEMBER_NAME_MAX } from '../schemas';

export interface RosterRow {
  user_id: string;
  display_name: string | null;
}

/** A name that fails to decrypt is dropped so one bad row cannot break the roster. */
export function decryptMemberNames(
  rows: readonly RosterRow[],
  kh: Buffer
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const row of rows) {
    if (!row.display_name) continue;
    try {
      const name = decryptPayload(row.display_name, kh).trim();
      if (name) names[row.user_id] = name;
    } catch {
      continue;
    }
  }
  return names;
}

/** Same fallback as the user menu: the full name, else the email local part. */
export function defaultDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const full = user.user_metadata?.full_name;
  const raw =
    typeof full === 'string' && full.trim()
      ? full
      : (user.email?.split('@')[0] ?? '');
  const name = raw.trim().slice(0, MEMBER_NAME_MAX).trim();
  return name || null;
}

/**
 * Seals the caller's account name under K_h when their row has none. Best
 * effort: a failure must never break household load or unlock.
 */
export async function seedOwnDisplayName(
  supabase: SupabaseClient,
  kh: Buffer
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    const name = data.user ? defaultDisplayName(data.user) : null;
    if (!name) return null;
    const { error } = await supabase.rpc('set_household_member_name', {
      p_display_name: encryptPayload(name, kh),
    });
    return error ? null : name;
  } catch {
    return null;
  }
}
