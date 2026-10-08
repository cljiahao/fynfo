import { buildPersonGroups } from '@/features/expenses/lib/owed';
import type { ExpenseData } from '@/features/expenses/types';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-06-15');

const shared = (
  o: Partial<ExpenseData> & Pick<ExpenseData, 'splits'>
): ExpenseData => ({
  id: 'e1',
  date: '2026-06-01',
  type: 'food_drink',
  item: '',
  info: '',
  amount: 0,
  splitType: 'shared',
  ...o,
});

describe('buildPersonGroups', () => {
  it('excludes paid splits from the balance while retaining month history', () => {
    const groups = buildPersonGroups(
      [
        shared({
          id: 'paid',
          splits: [{ person: 'Alice', amount: 20, settled: true }],
        }),
        shared({
          id: 'unpaid',
          splits: [{ person: 'Alice', amount: 5, settled: false }],
        }),
      ],
      NOW
    );
    expect(groups[0].totalOwed).toBe(5);
    expect(groups[0].months[0].total).toBe(25);
    expect(groups[0].months[0].settled).toBe(false);
    expect(groups[0].months[0].expenseIds).toEqual(['paid', 'unpaid']);

    const settled = buildPersonGroups(
      [shared({ splits: [{ person: 'Alice', amount: 25, settled: true }] })],
      NOW
    );
    expect(settled[0].totalOwed).toBe(0);
    expect(settled[0].months[0].total).toBe(25);
    expect(settled[0].months[0].settled).toBe(true);
  });

  it('ignores self (non-shared) expenses', () => {
    const groups = buildPersonGroups(
      [
        {
          id: 's',
          date: '2026-06-01',
          type: 'food_drink',
          item: '',
          info: '',
          amount: 10,
          splitType: 'self',
          splits: [],
        },
      ],
      NOW
    );
    expect(groups).toEqual([]);
  });

  it('groups by person + month and sums unsettled, deduping expense ids', () => {
    const groups = buildPersonGroups(
      [
        shared({
          id: 'a',
          date: '2026-06-01',
          splits: [{ person: 'Alice', amount: 20, settled: false }],
        }),
        shared({
          id: 'b',
          date: '2026-06-10',
          splits: [{ person: 'Alice', amount: 5, settled: false }],
        }),
        // two splits for the same person in one expense → id counted once
        shared({
          id: 'dup',
          date: '2026-06-12',
          splits: [
            { person: 'Alice', amount: 10, settled: false },
            { person: 'Alice', amount: 5, settled: false },
          ],
        }),
        // an earlier month so the per-person month sort runs
        shared({
          id: 'm',
          date: '2026-05-04',
          splits: [{ person: 'Alice', amount: 7, settled: false }],
        }),
      ],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].person).toBe('Alice');
    expect(groups[0].totalOwed).toBe(47);
    // Two months, sorted most-recent first.
    expect(groups[0].months.map((m) => m.monthKey)).toEqual([
      '2026-06',
      '2026-05',
    ]);
    expect(groups[0].months[0].total).toBe(40);
    expect(groups[0].months[0].settled).toBe(false);
    expect(groups[0].months[0].expenseIds).toEqual(['a', 'b', 'dup']);
    expect(groups[0].months[1].total).toBe(7);
  });

  it('drops settled months older than one year but keeps old unsettled months', () => {
    const groups = buildPersonGroups(
      [
        shared({
          id: 'old-settled',
          date: '2024-01-01',
          splits: [{ person: 'Alice', amount: 30, settled: true }],
        }),
        shared({
          id: 'old-unsettled',
          date: '2024-01-01',
          splits: [{ person: 'Bob', amount: 40, settled: false }],
        }),
      ],
      NOW
    );
    // Alice's only month is settled + older than NOW−1yr → filtered → Alice gone
    expect(groups.map((g) => g.person)).toEqual(['Bob']);
    expect(groups[0].totalOwed).toBe(40);
  });

  it('sorts by outstanding balance desc, then person name', () => {
    const groups = buildPersonGroups(
      [
        shared({
          id: 'a',
          splits: [{ person: 'Alice', amount: 20, settled: false }],
        }),
        shared({
          id: 'b',
          splits: [{ person: 'Bob', amount: 50, settled: false }],
        }),
        shared({
          id: 'c',
          splits: [{ person: 'Carol', amount: 20, settled: false }],
        }),
      ],
      NOW
    );
    expect(groups.map((g) => g.person)).toEqual(['Bob', 'Alice', 'Carol']);
  });
});
