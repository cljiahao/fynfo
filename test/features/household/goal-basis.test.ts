import {
  goalBasis,
  goalDeadline,
  goalPace,
  goalStatus,
  paidSeries,
  plannedTotal,
  savedStatus,
} from '@/features/household/lib/goal-stats';
import type { GoalItem, HouseholdGoal } from '@/features/household/types';
import { describe, expect, it } from 'vitest';
import { makeGoal } from './fixtures';

const NOW = new Date(2026, 10, 5);

function item(
  id: string,
  budget: number,
  opts: {
    quote?: number | null;
    dueDate?: string | null;
    payments?: Array<{ amount: number; date: string; isSelf?: boolean }>;
  } = {}
): GoalItem {
  const payments = (opts.payments ?? []).map((p, index) => ({
    id: `${id}-p${index}`,
    amount: p.amount,
    note: null,
    date: p.date,
    isSelf: p.isSelf ?? true,
  }));
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const effective = opts.quote ?? budget;
  return {
    id,
    name: `Item ${id}`,
    budget,
    quote: opts.quote ?? null,
    dueDate: opts.dueDate ?? null,
    description: null,
    payments,
    paid,
    remaining: Math.max(0, effective - paid),
    over: Math.max(0, paid - budget),
  };
}

function itemsGoal(
  items: GoalItem[],
  overrides: Partial<HouseholdGoal> = {}
): HouseholdGoal {
  return makeGoal({
    items,
    budgeted: items.reduce((sum, i) => sum + i.budget, 0),
    paid: items.reduce((sum, i) => sum + i.paid, 0),
    createdAt: '2026-10-01',
    ...overrides,
  });
}

describe('goalBasis', () => {
  it('is saved for a goal with no items', () => {
    expect(goalBasis(makeGoal())).toBe('saved');
  });

  it('is paid for items with no contributions', () => {
    expect(goalBasis(itemsGoal([item('a', 100)]))).toBe('paid');
  });

  it('is saved once any contribution exists', () => {
    expect(goalBasis(itemsGoal([item('a', 100)], { contributed: 1 }))).toBe(
      'saved'
    );
  });

  it('is saved when every item has a zero budget', () => {
    expect(goalBasis(itemsGoal([item('a', 0), item('b', 0)]))).toBe('saved');
  });

  it('counts a quote instead of the estimate', () => {
    const goal = itemsGoal([item('a', 0, { quote: 50 })]);
    expect(plannedTotal(goal)).toBe(50);
    expect(goalBasis(goal)).toBe('paid');
  });
});

describe('goalStatus in the paid basis', () => {
  it('is funded when every item is paid in full', () => {
    const goal = itemsGoal(
      [item('a', 100, { payments: [{ amount: 100, date: '2026-10-02' }] })],
      { targetDate: '2026-01-01' }
    );
    expect(goalStatus(goal, NOW)).toBe('funded');
  });

  it('is behind when one item is past due and unpaid', () => {
    const goal = itemsGoal([
      item('a', 100, { dueDate: '2026-11-04' }),
      item('b', 100, { dueDate: '2027-01-01' }),
    ]);
    expect(goalStatus(goal, NOW)).toBe('behind');
  });

  it('falls back to the goal date for an item without a due date', () => {
    const goal = itemsGoal([item('a', 100)], { targetDate: '2026-11-04' });
    expect(goalStatus(goal, NOW)).toBe('behind');
  });

  it('is no-date when nothing has a date', () => {
    expect(goalStatus(itemsGoal([item('a', 100)]), NOW)).toBe('no-date');
  });

  it('is on-track when dates exist and none is overdue', () => {
    const goal = itemsGoal([item('a', 100, { dueDate: '2026-12-01' })]);
    expect(goalStatus(goal, NOW)).toBe('on-track');
  });

  it('does not treat today as overdue', () => {
    const goal = itemsGoal([item('a', 100, { dueDate: '2026-11-05' })]);
    expect(goalStatus(goal, NOW)).toBe('on-track');
  });

  it('is not behind for an overdue item that is paid', () => {
    const goal = itemsGoal([
      item('a', 100, {
        dueDate: '2026-11-01',
        payments: [{ amount: 100, date: '2026-10-20' }],
      }),
      item('b', 100, { dueDate: '2027-01-01' }),
    ]);
    expect(goalStatus(goal, NOW)).toBe('on-track');
  });

  it('compares in whole cents', () => {
    const goal = itemsGoal([
      item('a', 0.3, {
        dueDate: '2026-11-01',
        payments: [
          { amount: 0.1, date: '2026-10-20' },
          { amount: 0.2, date: '2026-10-21' },
        ],
      }),
    ]);
    expect(goalStatus(goal, NOW)).toBe('funded');
  });

  it('leaves the saved basis unchanged', () => {
    const goal = itemsGoal([item('a', 100, { dueDate: '2026-01-01' })], {
      contributed: 10,
      remaining: 9990,
      targetDate: '2027-01-01',
    });
    expect(goalStatus(goal, NOW)).toBe('behind');
  });
});

describe('goalDeadline in the paid basis', () => {
  it('is funded, never overdue, once every item is paid', () => {
    const goal = itemsGoal(
      [item('a', 100, { payments: [{ amount: 100, date: '2026-10-02' }] })],
      { targetDate: '2026-01-01' }
    );
    expect(goalDeadline(goal, NOW)).toEqual({
      kind: 'funded',
      date: '2026-01-01',
    });
  });

  it('is overdue while items remain unpaid', () => {
    const goal = itemsGoal([item('a', 100)], { targetDate: '2026-11-03' });
    expect(goalDeadline(goal, NOW)).toMatchObject({
      kind: 'overdue',
      days: 2,
    });
  });
});

describe('goalPace', () => {
  it('uses what is left to pay in the paid basis', () => {
    const goal = itemsGoal(
      [item('a', 100, { payments: [{ amount: 100, date: '2026-10-02' }] })],
      { targetDate: '2026-01-01' }
    );
    expect(goalPace(goal, NOW, 50)).toBeNull();
  });

  it('keeps using remaining in the saved basis', () => {
    const goal = makeGoal({ targetDate: '2026-01-01', remaining: 10 });
    expect(goalPace(goal, NOW, 50)).toBe('past');
  });
});

describe('paidSeries', () => {
  it('accumulates payments per day, merges same-day entries and starts at 0', () => {
    const goal = itemsGoal([
      item('a', 300, {
        payments: [
          { amount: 100, date: '2026-10-10' },
          { amount: 50, date: '2026-10-10' },
        ],
      }),
      item('b', 300, { payments: [{ amount: 25, date: '2026-10-20' }] }),
    ]);
    const rows = paidSeries(goal, NOW);
    expect(rows.map((r) => [r.date, r.paid])).toEqual([
      ['2026-10-01', 0],
      ['2026-10-10', 150],
      ['2026-10-20', 175],
      ['2026-11-05', 175],
    ]);
  });

  it('starts at the first payment when it predates creation', () => {
    const goal = itemsGoal([
      item('a', 100, { payments: [{ amount: 10, date: '2026-09-15' }] }),
    ]);
    const rows = paidSeries(goal, NOW);
    expect(rows[0]).toMatchObject({ date: '2026-09-15', paid: 10 });
  });

  it('steps the due line up by effective amount and ends at the planned total', () => {
    const goal = itemsGoal(
      [
        item('a', 100, { dueDate: '2026-10-15' }),
        item('b', 200, { quote: 250, dueDate: '2026-12-01' }),
      ],
      { targetDate: null }
    );
    const rows = paidSeries(goal, NOW);
    const due = rows.filter((r) => r.due !== null).map((r) => r.due);
    expect(due).toEqual([0, 100, 350]);
    expect(due[due.length - 1]).toBe(plannedTotal(goal));
  });

  it('draws no due line when nothing has a date', () => {
    const goal = itemsGoal([
      item('a', 100, { payments: [{ amount: 10, date: '2026-10-10' }] }),
    ]);
    expect(paidSeries(goal, NOW).every((r) => r.due === null)).toBe(true);
  });

  it('uses the goal date for items without their own', () => {
    const goal = itemsGoal([item('a', 100)], { targetDate: '2026-12-31' });
    const rows = paidSeries(goal, NOW);
    expect(rows.find((r) => r.date === '2026-12-31')?.due).toBe(100);
  });
});

describe('savedStatus', () => {
  it('ignores the paid basis so household plan status is unchanged', () => {
    const goal = itemsGoal(
      [
        item('a', 100, {
          dueDate: '2027-06-01',
          payments: [{ amount: 100, date: '2026-10-02' }],
        }),
      ],
      { targetDate: '2026-11-01', remaining: 100 }
    );
    expect(goalBasis(goal)).toBe('paid');
    expect(goalStatus(goal, NOW)).toBe('funded');
    expect(savedStatus(goal, NOW)).toBe('behind');
  });
});
