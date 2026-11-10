import { derivePersonalSurplus } from '@/features/assets/lib/personal-surplus';
import { describe, expect, it } from 'vitest';

function snapshot(savings: number, bonds: number) {
  return {
    entries: [
      { category: 'savings' as const, account: 'Bank', amount: savings },
      { category: 'bonds' as const, account: 'SSB', amount: bonds },
      { category: 'stocks' as const, account: 'Stock', amount: 99999 },
    ],
  };
}

describe('derivePersonalSurplus', () => {
  it('returns null when there is no snapshot', () => {
    expect(
      derivePersonalSurplus({
        snapshots: [],
        settings: null,
        averageExpense: 1000,
        override: null,
      })
    ).toBeNull();
  });

  it('uses the default 3 and 9 months when settings are missing', () => {
    // Goals: 3 * 1000 + 9 * 1000 = 12000.
    expect(
      derivePersonalSurplus({
        snapshots: [snapshot(10000, 5000)],
        settings: null,
        averageExpense: 1000,
        override: null,
      })
    ).toBe(3000);
  });

  it('prefers the override over the rounded average', () => {
    const base = {
      snapshots: [snapshot(10000, 5000)],
      settings: null,
      averageExpense: 1000.4,
    };
    expect(derivePersonalSurplus({ ...base, override: null })).toBe(3000);
    expect(derivePersonalSurplus({ ...base, override: 500 })).toBe(8000);
  });

  it('honours saved months', () => {
    expect(
      derivePersonalSurplus({
        snapshots: [snapshot(10000, 5000)],
        settings: { emergencyMonths: 1, warChestMonths: 1 },
        averageExpense: 2000,
        override: null,
      })
    ).toBe(11000);
  });

  it('reads the last snapshot as the latest', () => {
    expect(
      derivePersonalSurplus({
        snapshots: [snapshot(100000, 100000), snapshot(10000, 5000)],
        settings: null,
        averageExpense: 1000,
        override: null,
      })
    ).toBe(3000);
  });

  it('never goes below zero', () => {
    expect(
      derivePersonalSurplus({
        snapshots: [snapshot(0, 0)],
        settings: null,
        averageExpense: 1000,
        override: null,
      })
    ).toBe(0);
  });
});
