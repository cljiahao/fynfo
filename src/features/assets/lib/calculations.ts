import type { AssetEntryData, SnapshotWithTotals } from '../types';

export function calculateTotal(entries: AssetEntryData[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function calculateMoMChange(
  current: number,
  previous: number
): { absolute: number; percentage: number } {
  const absolute = current - previous;
  const percentage = previous === 0 ? 0 : (absolute / previous) * 100;
  return { absolute, percentage };
}

export function getLatestSnapshot(
  snapshots: SnapshotWithTotals[]
): SnapshotWithTotals | undefined {
  return snapshots[snapshots.length - 1];
}

export function getPreviousSnapshot(
  snapshots: SnapshotWithTotals[],
  currentId: string
): SnapshotWithTotals | undefined {
  const idx = snapshots.findIndex((s) => s.id === currentId);
  return idx > 0 ? snapshots[idx - 1] : undefined;
}
