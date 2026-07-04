'use server';

import { requireActionContext, requireDbContext } from '@/lib/action-guard';
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
    .single();

  if (error || !data) return null;

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

  let snapshotId: string;

  if (originalId && originalId !== data.id) {
    // Move the existing row so the old month and its entries aren't orphaned;
    // UNIQUE(user_id, month) rejects a collision.
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

  await supabase.from('asset_entries').delete().eq('snapshot_id', snapshotId);

  const validEntries = data.entries.filter((e) => e.amount > 0);
  if (validEntries.length > 0) {
    const encEntries = await Promise.all(
      validEntries.map(async (e) => ({
        id: randomUUID(),
        snapshot_id: snapshotId,
        category: e.category,
        account: await encryptPayload(e.account || '', dek),
        amount: await encryptPayload(e.amount.toString(), dek),
      }))
    );

    const { error: insErr } = await supabase
      .from('asset_entries')
      .insert(encEntries);
    throwIfSupabaseError(insErr, 'asset_entries insert');
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { userId, supabase } = await requireDbContext();

  const { error } = await supabase
    .from('monthly_snapshots')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);

  throwIfSupabaseError(error, 'snapshot write');
}
