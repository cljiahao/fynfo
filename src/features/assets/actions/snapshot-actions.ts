'use server';

import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { requireUserId } from '@/lib/auth-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { getVaultDekSession } from '@/lib/keystore';
import { randomUUID } from 'crypto';
import type { ExportData, SnapshotData } from '../types';

type AssetEntryRow = {
  category: string;
  account: string | null;
  amount: string;
};

async function getDekOrThrow() {
  const dek = await getVaultDekSession();
  if (!dek) throw new Error('Vault is locked. Please unlock your vault.');
  return dek;
}

export async function getSnapshots(): Promise<SnapshotData[]> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*, entries:asset_entries(*)')
    .eq('user_id', userId)
    .order('month', { ascending: true });

  if (error) return [];

  return Promise.all(
    data.map(async (s) => {
      const decryptedEntries = await Promise.all(
        (s.entries || []).map(async (e: AssetEntryRow) => ({
          category: e.category as SnapshotData['entries'][number]['category'],
          account: await decryptPayload(e.account || '', dek),
          amount: Number(await decryptPayload(e.amount, dek)),
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
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

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
      account: await decryptPayload(e.account || '', dek),
      amount: Number(await decryptPayload(e.amount, dek)),
    }))
  );

  return {
    id: data.month,
    entries: decryptedEntries,
  };
}

export async function upsertSnapshot(data: SnapshotData): Promise<void> {
  const userId = await requireUserId();
  const dek = await getDekOrThrow();
  const supabase = await createSupabaseServerClient();

  // 1. Upsert snapshot
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

  if (snapErr) throw new Error(snapErr.message);

  const snapshotId = snapData.id;

  // 2. Delete old entries
  await supabase.from('asset_entries').delete().eq('snapshot_id', snapshotId);

  // 3. Encrypt & Insert new entries
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
    if (insErr) throw new Error(insErr.message);
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('monthly_snapshots')
    .delete()
    .eq('user_id', userId)
    .eq('month', id);

  if (error) throw new Error(error.message);
}

export async function exportData(): Promise<ExportData> {
  const snapshots = await getSnapshots();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    snapshots,
  };
}

export async function importData(data: ExportData): Promise<number> {
  let count = 0;
  for (const snapshot of data.snapshots) {
    await upsertSnapshot(snapshot);
    count++;
  }
  return count;
}
