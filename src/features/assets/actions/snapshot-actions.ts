'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { snapshotFormSchema } from '../schemas';
import type { SnapshotData } from '../types';

type AssetEntryRow = {
  snapshot_id: string;
  category: string;
  account: string | null;
  amount: string;
};

async function decryptEntries(entries: AssetEntryRow[], dek: Buffer) {
  return Promise.all(
    entries.map(async (entry) => ({
      category: entry.category as SnapshotData['entries'][number]['category'],
      account: await decryptOptionalString(entry.account, dek),
      amount: await decryptNumber(entry.amount, dek),
    }))
  );
}

export async function getSnapshots(): Promise<SnapshotData[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const snapshots = await readAllRows<{ id: string; month: string }>(
    (from, to) =>
      supabase
        .from('monthly_snapshots')
        .select('id, month', { count: 'exact' })
        .eq('user_id', userId)
        .order('month', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'snapshots read'
  );
  if (snapshots.length === 0) return [];
  const entries = await readAllRows<AssetEntryRow>(
    (from, to) =>
      supabase
        .from('asset_entries')
        .select(
          'snapshot_id, category, account, amount, parent:monthly_snapshots!inner(user_id)',
          { count: 'exact' }
        )
        .eq('parent.user_id', userId)
        .order('snapshot_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'snapshot entries read'
  );
  const entriesBySnapshot = new Map<string, AssetEntryRow[]>();
  for (const entry of entries) {
    const group = entriesBySnapshot.get(entry.snapshot_id) ?? [];
    group.push(entry);
    entriesBySnapshot.set(entry.snapshot_id, group);
  }
  return Promise.all(
    snapshots.map(async (snapshot) => ({
      id: snapshot.month,
      entries: await decryptEntries(
        entriesBySnapshot.get(snapshot.id) ?? [],
        dek
      ),
    }))
  );
}

export async function getSnapshot(id: string): Promise<SnapshotData | null> {
  const { userId, dek, supabase } = await requireActionContext();

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('id, month')
    .eq('user_id', userId)
    .eq('month', id)
    .maybeSingle();

  throwIfSupabaseError(error, 'snapshot read');
  if (!data) return null;

  const entries = await readAllRows<AssetEntryRow>(
    (from, to) =>
      supabase
        .from('asset_entries')
        .select('snapshot_id, category, account, amount', { count: 'exact' })
        .eq('snapshot_id', data.id)
        .order('id', { ascending: true })
        .range(from, to),
    'snapshot entries read'
  );

  return {
    id: data.month,
    entries: await decryptEntries(entries, dek),
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
