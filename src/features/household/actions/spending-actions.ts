'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { ROW_UUID } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import { addSpendingSchema, createSpaceSchema } from '../schemas';
import type {
  HouseholdSpace,
  HouseholdSpaceKind,
  SharedSpendingEntry,
} from '../types';

interface SpaceRow {
  id: string;
  kind: HouseholdSpaceKind;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

interface SpendingRow {
  id: string;
  space_id: string;
  payer_user_id: string;
  date: string;
  category: string;
  amount: string;
  note: string | null;
}

// Bound UUID filters as well as returned rows to keep request URLs manageable.
const ID_CHUNK = 100;

/** Reads the household's spaces with their decrypted spending, newest first. */
export async function getSpaces(): Promise<HouseholdSpace[]> {
  const { userId, kh, supabase } = await requireHouseholdContext();

  const spaces = await readAllRows<SpaceRow>(
    (from, to) =>
      supabase
        .from('household_spaces')
        .select('id, kind, name, start_date, end_date', { count: 'exact' })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'household spaces read'
  );
  if (spaces.length === 0) return [];

  const entriesBySpace = new Map<string, SharedSpendingEntry[]>();
  for (let offset = 0; offset < spaces.length; offset += ID_CHUNK) {
    const ids = spaces.slice(offset, offset + ID_CHUNK).map((s) => s.id);
    const rows = await readAllRows<SpendingRow>(
      (from, to) =>
        supabase
          .from('household_spending')
          .select('id, space_id, payer_user_id, date, category, amount, note', {
            count: 'exact',
          })
          .in('space_id', ids)
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      'household spending read'
    );
    for (const row of rows) {
      const list = entriesBySpace.get(row.space_id) ?? [];
      list.push({
        id: row.id,
        date: row.date,
        category: decryptPayload(row.category, kh),
        amount: Number(decryptPayload(row.amount, kh)),
        note: row.note ? decryptPayload(row.note, kh) : null,
        isSelf: row.payer_user_id === userId,
      });
      entriesBySpace.set(row.space_id, list);
    }
  }

  return spaces.map((space) => ({
    id: space.id,
    kind: space.kind,
    name: decryptPayload(space.name, kh),
    startDate: space.start_date,
    endDate: space.end_date,
    entries: entriesBySpace.get(space.id) ?? [],
  }));
}

/** Creates an ongoing space or a trip in the caller's household. */
export async function createSpace(input: unknown): Promise<void> {
  const data = parseOrThrow(createSpaceSchema, input, 'household.space.input');
  const { userId, kh, supabase } = await requireHouseholdContext();

  const { data: memberData, error: memberErr } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId);
  throwIfSupabaseError(memberErr, 'household member read');
  const householdId = ((memberData ?? [])[0] as { household_id: string })
    ?.household_id;
  if (!householdId) throw new Error('No household');

  const trip = data.kind === 'trip';
  const { error } = await supabase.from('household_spaces').insert({
    id: randomUUID(),
    household_id: householdId,
    kind: data.kind,
    name: encryptPayload(data.name, kh),
    start_date: trip ? (data.startDate ?? null) : null,
    end_date: trip ? (data.endDate ?? null) : null,
    created_by: userId,
  });
  throwIfSupabaseError(error, 'household space create');
}

/** Deletes a space (RLS scoped); its spending cascades. */
export async function deleteSpace(id: string): Promise<void> {
  parseOrThrow(ROW_UUID, id, 'household.deleteSpace.id');
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_spaces')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household space delete');
}

/** Records shared spending paid by the caller, sealed under K_h. */
export async function addSpending(input: unknown): Promise<void> {
  const data = parseOrThrow(
    addSpendingSchema,
    input,
    'household.spending.input'
  );
  const { userId, kh, supabase } = await requireHouseholdContext();
  const { error } = await supabase.from('household_spending').insert({
    id: randomUUID(),
    space_id: data.spaceId,
    payer_user_id: userId,
    date: data.date,
    category: encryptPayload(data.category, kh),
    amount: encryptPayload(data.amount.toString(), kh),
    note: data.note ? encryptPayload(data.note, kh) : null,
  });
  throwIfSupabaseError(error, 'household spending create');
}

/** Deletes one shared spending entry (RLS scoped). */
export async function deleteSpending(id: string): Promise<void> {
  parseOrThrow(ROW_UUID, id, 'household.deleteSpending.id');
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_spending')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household spending delete');
}
