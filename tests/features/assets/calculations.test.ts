import { describe, expect, it } from 'vitest';

import {
  calculateMoMChange,
  calculateTotal,
  getLatestSnapshot,
  getPreviousSnapshot,
} from '@/features/assets/lib/calculations';

import type { AssetEntryData, SnapshotWithTotals } from '@/features/assets/types';

function makeSnapshot(id: string, total: number): SnapshotWithTotals {
  return { id, entries: [], total };
}

describe('calculateTotal', () => {
  it('sums all entry amounts', () => {
    const entries: AssetEntryData[] = [
      { category: 'savings', account: 'POSB', amount: 5000 },
      { category: 'stocks', account: 'CDP', amount: 10000 },
      { category: 'crypto', account: 'Binance', amount: 2000 },
    ];
    expect(calculateTotal(entries)).toBe(17000);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('handles a single entry', () => {
    const entries: AssetEntryData[] = [{ category: 'savings', account: 'DBS', amount: 3000 }];
    expect(calculateTotal(entries)).toBe(3000);
  });

  it('handles entries with decimal amounts', () => {
    const entries: AssetEntryData[] = [
      { category: 'bonds', account: 'MAS', amount: 1000.5 },
      { category: 'savings', account: 'OCBC', amount: 499.5 },
    ];
    expect(calculateTotal(entries)).toBeCloseTo(1500);
  });
});

describe('calculateMoMChange', () => {
  it('calculates positive absolute and percentage change', () => {
    const result = calculateMoMChange(12000, 10000);
    expect(result.absolute).toBe(2000);
    expect(result.percentage).toBeCloseTo(20);
  });

  it('calculates negative change when current is lower', () => {
    const result = calculateMoMChange(8000, 10000);
    expect(result.absolute).toBe(-2000);
    expect(result.percentage).toBeCloseTo(-20);
  });

  it('returns 0 percentage when previous is zero to avoid division by zero', () => {
    const result = calculateMoMChange(5000, 0);
    expect(result.absolute).toBe(5000);
    expect(result.percentage).toBe(0);
  });

  it('returns zero absolute and percentage when current equals previous', () => {
    const result = calculateMoMChange(10000, 10000);
    expect(result.absolute).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('handles both being zero', () => {
    const result = calculateMoMChange(0, 0);
    expect(result.absolute).toBe(0);
    expect(result.percentage).toBe(0);
  });
});

describe('getLatestSnapshot', () => {
  it('returns the last snapshot in the array', () => {
    const snapshots = [
      makeSnapshot('2026-01', 10000),
      makeSnapshot('2026-02', 12000),
      makeSnapshot('2026-03', 15000),
    ];
    expect(getLatestSnapshot(snapshots)).toEqual(makeSnapshot('2026-03', 15000));
  });

  it('returns the only element when there is one snapshot', () => {
    const snapshots = [makeSnapshot('2026-01', 10000)];
    expect(getLatestSnapshot(snapshots)).toEqual(makeSnapshot('2026-01', 10000));
  });

  it('returns undefined for an empty array', () => {
    expect(getLatestSnapshot([])).toBeUndefined();
  });
});

describe('getPreviousSnapshot', () => {
  const snapshots = [
    makeSnapshot('2026-01', 10000),
    makeSnapshot('2026-02', 12000),
    makeSnapshot('2026-03', 15000),
  ];

  it('returns the snapshot immediately before the given id', () => {
    expect(getPreviousSnapshot(snapshots, '2026-03')).toEqual(makeSnapshot('2026-02', 12000));
    expect(getPreviousSnapshot(snapshots, '2026-02')).toEqual(makeSnapshot('2026-01', 10000));
  });

  it('returns undefined when given the first snapshot id', () => {
    expect(getPreviousSnapshot(snapshots, '2026-01')).toBeUndefined();
  });

  it('returns undefined when id is not found', () => {
    expect(getPreviousSnapshot(snapshots, '2025-12')).toBeUndefined();
  });

  it('returns undefined for an empty snapshot array', () => {
    expect(getPreviousSnapshot([], '2026-01')).toBeUndefined();
  });
});
