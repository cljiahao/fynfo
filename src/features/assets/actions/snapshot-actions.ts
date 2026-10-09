'use server';

import { requireActionContext } from '@/lib/action-guard';
import { encryptPayload } from '@/lib/crypto';
import { decryptNumber, decryptOptionalString } from '@/lib/crypto-fields';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { YYYY_MM } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  snapshotEditReadSchema,
  snapshotFormSchema,
  snapshotVersionSchema,
} from '../schemas';
import type {
  SnapshotData,
  SnapshotRecord,
  SnapshotVersion,
  SnapshotWriteResult,
} from '../types';

type AssetEntryRow = {
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

export async function getSnapshots(): Promise<SnapshotRecord[]> {
  const { userId, dek, supabase } = await requireActionContext();

  const snapshots = await readAllRows<{
    id: string;
    month: string;
    revision: string;
  }>(
    (from, to) =>
      supabase
        .from('monthly_snapshots')
        .select('id, month, revision::text', { count: 'exact' })
        .eq('user_id', userId)
        .order('month', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'snapshots read'
  );
  if (snapshots.length === 0) return [];
  const entries = await readAllRows<AssetEntryRow & { snapshot_id: string }>(
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
      ...parseOrThrow(
        snapshotVersionSchema,
        {
          snapshotId: snapshot.id,
          revision: snapshot.revision,
        },
        'snapshot.history.version'
      ),
      entries: await decryptEntries(
        entriesBySnapshot.get(snapshot.id) ?? [],
        dek
      ),
    }))
  );
}

export async function getSnapshot(id: string): Promise<SnapshotRecord | null> {
  parseOrThrow(YYYY_MM, id, 'snapshot.read.month');
  const { dek, supabase } = await requireActionContext();

  const { data, error } = await supabase.rpc('get_asset_snapshot_for_edit', {
    p_month: id,
  });

  throwIfSupabaseError(error, 'snapshot read');
  if (!data) return null;

  const record = parseOrThrow(
    snapshotEditReadSchema,
    data,
    'snapshot.read.result'
  );

  return {
    id: record.id,
    snapshotId: record.snapshotId,
    revision: record.revision,
    entries: await decryptEntries(record.entries, dek),
  };
}

export async function upsertSnapshot(
  data: SnapshotData,
  originalId?: string,
  expectedVersion?: SnapshotVersion
): Promise<SnapshotWriteResult> {
  parseOrThrow(snapshotFormSchema, data, 'snapshot.upsert.input');
  if (originalId !== undefined) {
    parseOrThrow(YYYY_MM, originalId, 'snapshot.original-month');
  }
  const { dek, supabase } = await requireActionContext();
  const version =
    originalId === undefined
      ? parseOrThrow(z.undefined(), expectedVersion, 'snapshot.create.version')
      : parseOrThrow(
          snapshotVersionSchema,
          expectedVersion,
          'snapshot.edit.version'
        );

  const validEntries = data.entries.filter((e) => e.amount > 0);
  const encEntries = await Promise.all(
    validEntries.map(async (e) => ({
      id: randomUUID(),
      category: e.category,
      account: await encryptPayload(e.account || '', dek),
      amount: await encryptPayload(e.amount.toString(), dek),
    }))
  );

  const { error } = await supabase.rpc('replace_asset_snapshot_if_current', {
    p_month: data.id,
    p_original_month: originalId ?? null,
    p_new_id: randomUUID(),
    p_expected_revision: version?.revision ?? null,
    p_expected_snapshot_id: version?.snapshotId ?? null,
    p_entries: encEntries,
  });
  if (error?.code === 'PFS01') return { ok: false, code: 'CONFLICT' };
  throwIfSupabaseError(error, 'snapshot save');
  return { ok: true };
}

export async function deleteSnapshot(
  id: string,
  expectedVersion: SnapshotVersion
): Promise<SnapshotWriteResult> {
  const { supabase } = await requireActionContext();
  parseOrThrow(YYYY_MM, id, 'snapshot.delete.month');
  const version = parseOrThrow(
    snapshotVersionSchema,
    expectedVersion,
    'snapshot.delete.version'
  );

  const { error } = await supabase.rpc('delete_asset_snapshot_if_current', {
    p_month: id,
    p_expected_revision: version.revision,
    p_expected_snapshot_id: version.snapshotId,
  });

  if (error?.code === 'PFS01') return { ok: false, code: 'CONFLICT' };
  throwIfSupabaseError(error, 'snapshot write');
  return { ok: true };
}
