import {
  cumulativeContributions,
  itemChartRows,
  monthlyPaceNeeded,
  recentActivity,
  summarizeBreakdown,
  withoutPending,
} from '@/features/household/lib/goal-stats';
import type {
  GoalItem,
  GoalItemPayment,
  HouseholdGoal,
} from '@/features/household/types';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 10, 4);

function item(
  id: string,
  budget: number,
  payments: Array<Partial<GoalItemPayment> & { amount: number }> = []
): GoalItem {
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    id,
    name: `Item ${id}`,
    budget,
    quote: null,
    paid,
    remaining: Math.max(0, budget - paid),
    over: Math.max(0, paid - budget),
    payments: payments.map((p, index) => ({
      id: `${id}-p${index}`,
      note: null,
      date: '2026-10-01',
      isSelf: true,
      ...p,
    })),
  };
}

function goal(overrides: Partial<HouseholdGoal> = {}): HouseholdGoal {
  return {
    id: 'g',
    name: 'Goal',
    targetAmount: 1200,
    targetDate: null,
    createdAt: '2026-01-01',
    contributions: [],
    contributed: 0,
    remaining: 1200,
    pct: 0,
    items: [],
    budgeted: 0,
    paid: 0,
    ...overrides,
  };
}

describe('monthlyPaceNeeded', () => {
  it('divides the remainder across whole months to a future date', () => {
    expect(
      monthlyPaceNeeded(goal({ targetDate: '2027-02-04' }), NOW)
    ).toBeCloseTo(400);
  });

  it('rounds a partial month up so the pace never understates', () => {
    expect(
      monthlyPaceNeeded(goal({ targetDate: '2027-02-05' }), NOW)
    ).toBeCloseTo(300);
  });

  it('uses one month minimum when the date is later this month', () => {
    expect(monthlyPaceNeeded(goal({ targetDate: '2026-11-20' }), NOW)).toBe(
      1200
    );
  });

  it('treats a date of today as one month, not past', () => {
    expect(monthlyPaceNeeded(goal({ targetDate: '2026-11-04' }), NOW)).toBe(
      1200
    );
  });

  it('reports a passed date while still short', () => {
    expect(monthlyPaceNeeded(goal({ targetDate: '2026-11-03' }), NOW)).toBe(
      'past'
    );
  });

  it('has no pace without a date', () => {
    expect(monthlyPaceNeeded(goal(), NOW)).toBeNull();
  });

  it('has no pace once funded, even past the date', () => {
    expect(
      monthlyPaceNeeded(goal({ targetDate: '2026-01-01', remaining: 0 }), NOW)
    ).toBeNull();
  });
});

describe('cumulativeContributions', () => {
  const contribution = (id: string, amount: number, date: string) => ({
    id,
    amount,
    date,
    note: null,
    isSelf: true,
  });

  it('is empty without contributions', () => {
    expect(cumulativeContributions(goal())).toEqual([]);
  });

  it('returns a single point for one contribution', () => {
    expect(
      cumulativeContributions(
        goal({ contributions: [contribution('a', 100, '2026-10-01')] })
      )
    ).toEqual([{ date: '2026-10-01', total: 100 }]);
  });

  it('orders by date and accumulates', () => {
    expect(
      cumulativeContributions(
        goal({
          contributions: [
            contribution('b', 50, '2026-10-05'),
            contribution('a', 100, '2026-10-01'),
          ],
        })
      )
    ).toEqual([
      { date: '2026-10-01', total: 100 },
      { date: '2026-10-05', total: 150 },
    ]);
  });

  it('merges same-day contributions into one point', () => {
    expect(
      cumulativeContributions(
        goal({
          contributions: [
            contribution('a', 100, '2026-10-01'),
            contribution('b', 25, '2026-10-01T09:00:00Z'),
            contribution('c', 10, '2026-10-02'),
          ],
        })
      )
    ).toEqual([
      { date: '2026-10-01', total: 125 },
      { date: '2026-10-02', total: 135 },
    ]);
  });
});

describe('itemChartRows', () => {
  it('is empty with zero items', () => {
    expect(itemChartRows(goal())).toEqual({ rows: [], more: 0 });
  });

  it('keeps every item under the cap, largest budget first', () => {
    const { rows, more } = itemChartRows(
      goal({ items: [item('a', 100), item('b', 300), item('c', 200)] })
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(more).toBe(0);
  });

  it('caps at 8 by default and counts the remainder', () => {
    const items = Array.from({ length: 11 }, (_, i) => item(`i${i}`, i + 1));
    const { rows, more } = itemChartRows(goal({ items }));
    expect(rows).toHaveLength(8);
    expect(rows[0]?.id).toBe('i10');
    expect(more).toBe(3);
  });

  it('honours a custom cap', () => {
    const { rows, more } = itemChartRows(
      goal({ items: [item('a', 1), item('b', 2), item('c', 3)] }),
      2
    );
    expect(rows).toHaveLength(2);
    expect(more).toBe(1);
  });

  it('carries the over-budget amount for colouring', () => {
    const { rows } = itemChartRows(
      goal({ items: [item('a', 100, [{ amount: 150 }])] })
    );
    expect(rows[0]).toMatchObject({ paid: 150, over: 50 });
  });
});

describe('recentActivity', () => {
  const data = goal({
    contributions: [
      {
        id: 'c1',
        amount: 100,
        date: '2026-10-03',
        note: null,
        isSelf: true,
      },
      {
        id: 'c2',
        amount: 40,
        date: '2026-10-09',
        note: null,
        isSelf: false,
      },
    ],
    items: [
      item('v', 500, [
        { amount: 200, date: '2026-10-06', isSelf: false },
        { amount: 50, date: '2026-10-01', isSelf: true },
      ]),
    ],
  });

  it('merges contributions and payments newest first', () => {
    expect(recentActivity(data, 10).map((e) => e.id)).toEqual([
      'c2',
      'v-p0',
      'c1',
      'v-p1',
    ]);
  });

  it('carries who acted and the item for payments', () => {
    const entries = recentActivity(data, 10);
    expect(entries[0]).toMatchObject({
      kind: 'contribution',
      isSelf: false,
      itemName: null,
    });
    expect(entries[1]).toMatchObject({
      kind: 'payment',
      isSelf: false,
      itemName: 'Item v',
    });
  });

  it('applies the limit after sorting', () => {
    expect(recentActivity(data, 2).map((e) => e.id)).toEqual(['c2', 'v-p0']);
  });

  it('is empty without activity', () => {
    expect(recentActivity(goal(), 8)).toEqual([]);
  });
});

describe('summarizeBreakdown', () => {
  const plain = (value: string) => value;

  it('prompts to split when there are no items', () => {
    expect(summarizeBreakdown(goal(), plain)).toEqual({
      text: 'Split into budget items',
      over: false,
    });
  });

  it('summarises count and totals', () => {
    const result = summarizeBreakdown(
      goal({
        items: [item('a', 100, [{ amount: 40 }])],
        paid: 40,
        budgeted: 100,
      }),
      plain
    );
    expect(result.text).toMatch(/^1 item · .*40\.00 of .*100\.00$/);
    expect(result.over).toBe(false);
  });

  it('flags paid above budget and pluralises', () => {
    const result = summarizeBreakdown(
      goal({
        items: [item('a', 100), item('b', 100)],
        paid: 250,
        budgeted: 200,
      }),
      plain
    );
    expect(result.text).toMatch(/^2 items/);
    expect(result.over).toBe(true);
  });

  it('routes amounts through the mask', () => {
    const result = summarizeBreakdown(
      goal({ items: [item('a', 100)], paid: 40, budgeted: 100 }),
      () => 'Hidden'
    );
    expect(result.text).toBe('1 item · Hidden of Hidden');
  });
});

describe('withoutPending', () => {
  const base = goal({
    items: [
      item('a', 100, [{ amount: 60 }, { amount: 30 }]),
      item('b', 200, [{ amount: 10 }]),
    ],
    budgeted: 300,
    paid: 100,
  });

  it('returns the same goal when nothing is pending', () => {
    expect(withoutPending(base, new Set())).toBe(base);
  });

  it('drops a pending item from the totals', () => {
    const result = withoutPending(base, new Set(['a']));
    expect(result.items.map((i) => i.id)).toEqual(['b']);
    expect(result.budgeted).toBe(200);
    expect(result.paid).toBe(10);
  });

  it('subtracts a pending payment from its item and the total', () => {
    const result = withoutPending(base, new Set(['a-p0']));
    expect(result.items[0]?.paid).toBe(30);
    expect(result.items[0]?.remaining).toBe(70);
    expect(result.paid).toBe(40);
  });
});
