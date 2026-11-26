'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { memberDisplayNameSchema } from '../schemas';

/** Seals the caller's own display name under K_h; the RPC can only touch their own row. */
export async function setMemberDisplayName(input: unknown): Promise<void> {
  const { name } = parseOrThrow(
    memberDisplayNameSchema,
    input,
    'household.memberName.input'
  );
  const { kh, supabase } = await requireHouseholdContext();
  const { error } = await supabase.rpc('set_household_member_name', {
    p_display_name: encryptPayload(name, kh),
  });
  throwIfSupabaseError(error, 'household member name save');
}
