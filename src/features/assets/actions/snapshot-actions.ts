'use server';

import { requireUserId } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import type { ExportData, SnapshotData } from '../types';

export async function getSnapshots(): Promise<SnapshotData[]> {
  const userId = await requireUserId();

  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { userId },
    include: { entries: true },
    orderBy: { month: 'asc' },
  });

  return snapshots.map((s) => ({
    id: s.month,
    entries: s.entries.map((e) => ({
      category: e.category as SnapshotData['entries'][number]['category'],
      account: e.account,
      amount: Number(e.amount),
    })),
  }));
}

export async function getSnapshot(id: string): Promise<SnapshotData | null> {
  const userId = await requireUserId();

  const snapshot = await prisma.monthlySnapshot.findUnique({
    where: { userId_month: { userId, month: id } },
    include: { entries: true },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.month,
    entries: snapshot.entries.map((e) => ({
      category: e.category as SnapshotData['entries'][number]['category'],
      account: e.account,
      amount: Number(e.amount),
    })),
  };
}

export async function upsertSnapshot(data: SnapshotData): Promise<void> {
  const userId = await requireUserId();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.monthlySnapshot.findUnique({
      where: { userId_month: { userId, month: data.id } },
    });

    if (existing) {
      await tx.assetEntry.deleteMany({
        where: { snapshotId: existing.id },
      });
    }

    await tx.monthlySnapshot.upsert({
      where: { userId_month: { userId, month: data.id } },
      create: {
        month: data.id,
        userId,
        entries: {
          create: data.entries
            .filter((e) => e.amount > 0)
            .map((e) => ({
              category: e.category,
              account: e.account,
              amount: e.amount,
            })),
        },
      },
      update: {
        entries: {
          create: data.entries
            .filter((e) => e.amount > 0)
            .map((e) => ({
              category: e.category,
              account: e.account,
              amount: e.amount,
            })),
        },
      },
    });
  });
}

export async function deleteSnapshot(id: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.monthlySnapshot.delete({
    where: { userId_month: { userId, month: id } },
  });
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
