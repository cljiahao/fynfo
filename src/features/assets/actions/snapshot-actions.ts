'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { snapshotFormSchema } from '../schemas';
import type { SnapshotData } from '../types';

type AssetEntryRow = {
  category: string;
  account: string | null;
  amount: string;
};

export async function getSnapshots(): Promise<SnapshotData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*, entries:asset_entries(*)')
    .eq('user_id', userId)
    .order('month', { ascending: true });

  throwIfSupabaseError(error, 'snapshots read');

  return Promise.all(
    (data || []).map(async (s) => {
      const decryptedEntries = await Promise.all(
        (s.entries || []).map(async (e: AssetEntryRow) => ({
          category: e.category as SnapshotData['entries'][number]['category'],
          account: await decryptOptionalString(e.account, dek),
          amount: await decryptNumber(e.amount, dek),
        }))
      );

      return {
        id: s.month,
        entries: decryptedEntries,
      };
    })
  );
}

export async function getSnapshot(id: string): Promise<SnapshotData | null> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*, entries:asset_entries(*)')
    .eq('user_id', userId)
    .eq('month', id)
    .maybeSingle();

  throwIfSupabaseError(error, 'snapshot read');
  if (!data) return null;

  const decryptedEntries = await Promise.all(
    (data.entries || []).map(async (e: AssetEntryRow) => ({
      category: e.category as SnapshotData['entries'][number]['category'],
      account: await decryptOptionalString(e.account, dek),
      amount: await decryptNumber(e.amount, dek),
    }))
  );

  return {
    id: data.month,
    entries: decryptedEntries,
  };
}

export async function upsertSnapshot(
  data: SnapshotData,
  originalId?: string
): Promise<void> {
  parseOrThrow(snapshotFormSchema, data, 'snapshot.upsert.input');
  const { userId, dek, supabase } = await requireActionContext();

  const validEntries = data.entries.filter((e) => e.amount > 0);
  const encEntries = await Promise.all(
    validEntries.map(async (e) => ({
      id: randomUUID(),
      category: e.category,
      account: await encryptPayload(e.account || '', dek),
      amount: await encryptPayload(e.amount.toString(), dek),
    }))
  );

  let snapshotId: string;

  if (originalId) {
    // Preserve the parent ID referenced by saved entries; month collisions
    // are rejected by UNIQUE(user_id, month).
    const { error: renameErr, data: renamedData } = await supabase
      .from('monthly_snapshots')
      .update({
        month: data.id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('month', originalId)
      .select('id')
      .single();

    throwIfSupabaseError(renameErr, 'snapshot rename');
    snapshotId = renamedData.id;
  } else {
    const { error: snapErr, data: snapData } = await supabase
      .from('monthly_snapshots')
      .upsert(
        {
          id: randomUUID(),
          month: data.id,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id, month',
        }
      )
      .select('id')
      .single();

    throwIfSupabaseError(snapErr, 'snapshot upsert');
    snapshotId = snapData.id;
  }

  const { error: deleteErr } = await supabase
    .from('asset_entries')
    .delete()
    .eq('snapshot_id', snapshotId);
  throwIfSupabaseError(deleteErr, 'asset_entries delete');

  if (encEntries.length > 0) {
    const { error: insErr } = await supabase
      .from('asset_entries')
      .insert(
        encEntries.map((entry) => ({ ...entry, snapshot_id: snapshotId }))
      );
    throwIfSupabaseError(insErr, 'asset_entries insert');
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { userId, supabase } = await requireActionContext();

  const { error } = await supabase
    .from('monthly_snapshots')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);

  throwIfSupabaseError(error, 'snapshot write');
}
