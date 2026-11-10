import {
  computeHouseholdPlan,
  householdRecommendations,
  type PlanBudget,
  type PlanGoal,
  type PlanItem,
} from '@/features/household/lib/household-plan';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 0, 15);
const D2 = '2026-03-15';
const D18 = '2027-07-15';

function item(over: Partial<PlanItem> & { id: string }): PlanItem {
  return { name: over.id, effective: 0, paid: 0, dueDate: null, ...over };
}

function goal(over: Partial<PlanGoal> & { id: string }): PlanGoal {
  return {
    name: over.id,
    targetDate: null,
    createdAt: '2026-01-01',
    targetAmount: 0,
    contributed: 0,
    remaining: 0,
    share: 1,
    items: [],
    ...over,
  };
}

/** A goal comfortably ahead of its straight-line pace, so it is never behind. */
function steady(over: Partial<PlanGoal> & { id: string }): PlanGoal {
  const target = over.targetAmount ?? 1000;
  return goal({
    createdAt: '2026-01-15',
    targetAmount: target,
    contributed: target * 0.05,
    remaining: target * 0.95,
    ...over,
  });
}

/** Wedding: target 46,000, deposit 10,000 at 2 months, balance 36,000 at 18. */
function wedding(over: Partial<PlanGoal> = {}): PlanGoal {
  const contributed = over.contributed ?? 0;
  return goal({
    id: 'wedding',
    name: 'Wedding',
    targetAmount: 46000,
    targetDate: D18,
    contributed,
    remaining: Math.max(0, 46000 - contributed),
    share: 0.5,
    items: [
      item({
        id: 'deposit',
        name: 'Venue deposit',
        effective: 10000,
        dueDate: D2,
      }),
      item({ id: 'balance', name: 'Balance', effective: 36000, dueDate: D18 }),
    ],
    ...over,
  });
}

function plan(goals: PlanGoal[], surplus = 0, budgets: PlanBudget[] = []) {
  return computeHouseholdPlan({ goals, budgets }, { surplus, now: NOW });
}

function recs(
  goals: PlanGoal[],
  surplus = 0,
  shortfallPerMonth?: number,
  now: Date = NOW
) {
  const p = computeHouseholdPlan({ goals, budgets: [] }, { surplus, now });
  return householdRecommendations({ goals }, p, { now, shortfallPerMonth });
}

describe('schedule placement (latest first)', () => {
  it('schedules only the balance when contributions cover the deposit', () => {
    const p = plan([wedding({ contributed: 10000 })]);
    expect(p.schedule).toEqual([
      {
        goalId: 'wedding',
        itemId: 'balance',
        label: 'Balance',
        date: D18,
        amount: 18000,
      },
    ]);
  });

  it('puts the leftover on the deposit when contributions are 5,000', () => {
    const p = plan([wedding({ contributed: 5000 })]);
    expect(p.schedule.map((e) => [e.itemId, e.date, e.amount])).toEqual([
      ['deposit', D2, 2500],
      ['balance', D18, 18000],
    ]);
  });

  it('gives the same schedule when the deposit is paid and 10,000 contributed', () => {
    const paid = wedding({
      contributed: 10000,
      items: [
        item({
          id: 'deposit',
          effective: 10000,
          paid: 10000,
          dueDate: D2,
        }),
        item({ id: 'balance', effective: 36000, dueDate: D18 }),
      ],
    });
    const p = plan([paid]);
    expect(p.schedule.map((e) => [e.itemId, e.amount])).toEqual([
      ['balance', 18000],
    ]);
    expect(p.goalsMonthly).toBeCloseTo(1000, 6);
  });

  it('falls back to the goal date for an item without a date', () => {
    const g = goal({
      id: 'g',
      targetDate: D18,
      targetAmount: 1000,
      remaining: 1000,
      items: [item({ id: 'a', effective: 1000 })],
    });
    expect(plan([g]).schedule[0]).toMatchObject({ itemId: 'a', date: D18 });
  });

  it('places everything on the target date when there are no items', () => {
    const g = goal({
      id: 'g',
      targetDate: D18,
      targetAmount: 1200,
      remaining: 1000,
      share: 0.5,
    });
    const p = plan([g]);
    expect(p.schedule).toEqual([
      { goalId: 'g', itemId: null, label: 'g', date: D18, amount: 500 },
    ]);
  });

  it('adds the part of the target above the item total on the goal date, ordered by date', () => {
    const g = goal({
      id: 'g',
      targetDate: '2026-09-15',
      targetAmount: 1500,
      remaining: 1500,
      items: [item({ id: 'a', effective: 1000, dueDate: '2026-12-15' })],
    });
    const p = plan([g]);
    expect(p.schedule.map((e) => [e.itemId, e.date, e.amount])).toEqual([
      [null, '2026-09-15', 500],
      ['a', '2026-12-15', 1000],
    ]);
  });

  it('trims the earliest items when items exceed the remaining total', () => {
    const g = goal({
      id: 'g',
      targetDate: '2026-12-15',
      targetAmount: 1000,
      remaining: 1000,
      items: [
        item({ id: 'early', effective: 800, dueDate: '2026-03-15' }),
        item({ id: 'late', effective: 800, dueDate: '2026-12-15' }),
      ],
    });
    const p = plan([g]);
    expect(p.schedule.map((e) => [e.itemId, e.amount])).toEqual([
      ['early', 200],
      ['late', 800],
    ]);
  });

  it('equals remaining x share when T >= E and c >= P', () => {
    const g = wedding({ contributed: 7000 });
    const total = plan([g]).schedule.reduce((s, e) => s + e.amount, 0);
    expect(total).toBeCloseTo(g.remaining * g.share, 6);
  });

  it('drops the schedule below remaining by P - c for a payment without a contribution', () => {
    const g = wedding({
      contributed: 0,
      items: [
        item({ id: 'deposit', effective: 10000, paid: 10000, dueDate: D2 }),
        item({ id: 'balance', effective: 36000, dueDate: D18 }),
      ],
    });
    const total = plan([g]).schedule.reduce((s, e) => s + e.amount, 0);
    expect(total).toBeCloseTo((g.remaining - 10000) * g.share, 6);
    expect(total).toBeLessThanOrEqual(g.remaining * g.share);
  });

  it('skips a goal with no date and no dated items, and a funded goal', () => {
    const undated = goal({
      id: 'u',
      targetAmount: 500,
      remaining: 500,
      items: [item({ id: 'a', effective: 500 })],
    });
    const funded = goal({
      id: 'f',
      targetDate: D18,
      targetAmount: 500,
      contributed: 500,
      remaining: 0,
    });
    const p = plan([undated, funded]);
    expect(p.schedule).toEqual([]);
    expect(p.monthly).toBe(0);
  });

  it('excludes a goal where the caller share is 0', () => {
    const g = wedding({ share: 0 });
    const p = plan([g]);
    expect(p.schedule).toEqual([]);
    expect(p.perGoal).toEqual([]);
    expect(recs([g])).toEqual([]);
  });
});

describe('tightest deadline', () => {
  it('uses the deposit when nothing is set aside', () => {
    const p = plan([wedding()]);
    expect(p.goalsMonthly).toBeCloseTo(2500, 6);
    expect(p.bindingMonths).toBe(2);
  });

  it('moves to the balance once 3,000 is set aside', () => {
    const p = plan([wedding()], 3000);
    expect(p.goalsMonthly).toBeCloseTo(20000 / 18, 6);
    expect(p.goalsMonthly).toBeCloseTo(1111.11, 2);
    expect(p.bindingMonths).toBe(18);
  });

  it('falls to 1,125 once the deposit is paid two months later', () => {
    const later = new Date(2026, 2, 15);
    const g = wedding({
      items: [
        item({ id: 'deposit', effective: 10000, paid: 10000, dueDate: D2 }),
        item({ id: 'balance', effective: 36000, dueDate: D18 }),
      ],
    });
    const p = computeHouseholdPlan(
      { goals: [g], budgets: [] },
      { surplus: 0, now: later }
    );
    expect(p.goalsMonthly).toBeCloseTo(1125, 6);
  });

  it('gives 1,000 a month with contributions of 10,000', () => {
    expect(plan([wedding({ contributed: 10000 })]).goalsMonthly).toBeCloseTo(
      1000,
      6
    );
  });

  it('has no cliff between 23 and 25 months', () => {
    const at = (date: string) =>
      plan([
        goal({
          id: 'g',
          targetDate: date,
          targetAmount: 12000,
          remaining: 12000,
        }),
      ]).goalsMonthly;
    const near = at('2027-12-15');
    const far = at('2028-02-15');
    expect(near).toBeCloseTo(12000 / 23, 6);
    expect(far).toBeCloseTo(12000 / 25, 6);
    expect(near / far).toBeCloseTo(25 / 23, 6);
  });

  it('counts overdue entries as one month', () => {
    const g = goal({
      id: 'g',
      targetDate: '2026-01-01',
      targetAmount: 600,
      remaining: 600,
    });
    const p = plan([g]);
    expect(p.goalsMonthly).toBe(600);
    expect(p.bindingMonths).toBe(1);
  });

  it('counts an entry due this calendar month as one month', () => {
    const g = goal({
      id: 'g',
      targetDate: '2026-01-31',
      targetAmount: 600,
      remaining: 600,
    });
    const p = plan([g]);
    expect(p.goalsMonthly).toBe(600);
    expect(p.bindingMonths).toBe(1);
  });

  it('reports null bindingMonths when goalsMonthly is 0', () => {
    expect(plan([]).bindingMonths).toBeNull();
    expect(plan([wedding()], 1e9).bindingMonths).toBeNull();
  });

  it('adds budgets as a flat share on top', () => {
    const p = plan([], 0, [
      { id: 'b1', monthlyAmount: 400, share: 0.5 },
      { id: 'b2', monthlyAmount: 100, share: 0 },
    ]);
    expect(p.budgetsMonthly).toBe(200);
    expect(p.goalsMonthly).toBe(0);
    expect(p.monthly).toBe(200);
  });

  it('monthly is goals plus budgets', () => {
    const p = plan([wedding()], 0, [
      { id: 'b', monthlyAmount: 100, share: 0.5 },
    ]);
    expect(p.monthly).toBeCloseTo(2550, 6);
  });
});

describe('surplus offset', () => {
  it('applies earliest first and changes the tightest deadline', () => {
    const p = plan([wedding()], 5000);
    expect(p.schedule.map((e) => [e.itemId, e.amount])).toEqual([
      ['balance', 18000],
    ]);
    expect(p.goalsMonthly).toBeCloseTo(1000, 6);
    expect(p.bindingMonths).toBe(18);
  });

  it('never uses more than the surplus and reports the used part', () => {
    const p = plan([wedding()], 3000);
    expect(p.surplusUsed).toBe(3000);
    const huge = plan([wedding()], 1e9);
    expect(huge.surplusUsed).toBe(23000);
    expect(huge.schedule).toEqual([]);
  });

  it('spreads across goals by date, ties by goal id', () => {
    const a = goal({
      id: 'a',
      targetDate: D18,
      targetAmount: 100,
      remaining: 100,
    });
    const b = goal({
      id: 'b',
      targetDate: D18,
      targetAmount: 100,
      remaining: 100,
    });
    const early = goal({
      id: 'z',
      targetDate: D2,
      targetAmount: 50,
      remaining: 50,
    });
    const p = plan([b, a, early], 120);
    const by = Object.fromEntries(p.perGoal.map((g) => [g.goalId, g]));
    expect(by.z.surplusUsed).toBe(50);
    expect(by.a.surplusUsed).toBe(70);
    expect(by.b.surplusUsed).toBe(0);
    expect(p.surplusUsed).toBe(120);
  });

  it('ignores a negative surplus', () => {
    expect(plan([wedding()], -50).surplusUsed).toBe(0);
  });

  it('keeps per-goal totals consistent with the schedule', () => {
    const p = plan([wedding()], 3000);
    expect(p.perGoal[0].scheduleTotal).toBe(20000);
    expect(p.perGoal[0].surplusUsed).toBe(3000);
    expect(p.perGoal[0].monthly).toBeCloseTo(p.goalsMonthly, 6);
  });
});

describe('recommendation: next-payment', () => {
  const mk = (date: string) =>
    goal({
      id: 'g',
      name: 'Trip',
      targetDate: date,
      targetAmount: 1000,
      remaining: 1000,
    });

  it('fires on day 90 and not on day 91', () => {
    expect(recs([mk('2026-04-15')]).map((r) => r.kind)).toContain(
      'next-payment'
    );
    expect(recs([mk('2026-04-16')]).map((r) => r.kind)).not.toContain(
      'next-payment'
    );
  });

  it('fires for an overdue entry', () => {
    const r = recs([mk('2025-12-01')]).find((x) => x.kind === 'next-payment');
    expect(r).toMatchObject({
      goalId: 'g',
      label: 'Trip',
      amounts: { amount: 1000 },
      dates: { due: '2025-12-01' },
    });
  });

  it('names the earliest entry with an amount, after the offset', () => {
    const r = recs([wedding()]).find((x) => x.kind === 'next-payment');
    expect(r).toMatchObject({
      label: 'Venue deposit',
      amounts: { amount: 5000 },
      dates: { due: D2 },
    });
    const covered = recs([wedding()], 5000).find(
      (x) => x.kind === 'next-payment'
    );
    expect(covered).toBeUndefined();
  });

  it('is silent when contributions cover the deposit', () => {
    expect(
      recs([wedding({ contributed: 10000 })]).some(
        (r) => r.kind === 'next-payment'
      )
    ).toBe(false);
  });
});

describe('recommendation: behind', () => {
  // Expected saved today is 5490 * 184 / 549 = 1840; target in 12 months.
  const lagging = (over: Partial<PlanGoal> = {}) =>
    goal({
      id: 'reno',
      name: 'Renovation',
      createdAt: '2025-07-15',
      targetDate: '2027-01-15',
      targetAmount: 5490,
      contributed: 1000,
      remaining: 4490,
      share: 0.5,
      ...over,
    });

  it('reports the shortfall against pace times share, with a catch-up', () => {
    const r = recs([lagging()]).find((x) => x.kind === 'behind');
    expect(r).toMatchObject({ kind: 'behind', goalId: 'reno' });
    if (r?.kind !== 'behind') throw new Error('expected behind');
    expect(r.amounts.behind).toBeCloseTo(420, 6);
    expect(r.amounts.catchUpPerMonth).toBeCloseTo(35, 6);
    expect(r.dates.target).toBe('2027-01-15');
  });

  it('computes the amount and catch-up after a partial offset', () => {
    const r = recs([lagging()], 200).find((x) => x.kind === 'behind');
    if (r?.kind !== 'behind') throw new Error('expected behind');
    expect(r.amounts.behind).toBeCloseTo(220, 6);
    expect(r.amounts.catchUpPerMonth).toBeCloseTo(220 / 12, 6);
  });

  it('emits no behind when the surplus absorbs it, and paces instead', () => {
    const kinds = recs([lagging()], 420).map((r) => r.kind);
    expect(kinds).not.toContain('behind');
    expect(kinds).toContain('monthly-pace');
  });

  it('treats an overdue goal as behind with one month to catch up', () => {
    const r = recs([
      goal({
        id: 'late',
        targetDate: '2025-12-01',
        createdAt: '2025-01-01',
        targetAmount: 1000,
        contributed: 400,
        remaining: 600,
        share: 0.5,
      }),
    ]).find((x) => x.kind === 'behind');
    if (r?.kind !== 'behind') throw new Error('expected behind');
    expect(r.amounts.behind).toBeCloseTo(300, 6);
    expect(r.amounts.catchUpPerMonth).toBeCloseTo(300, 6);
  });

  it('is not emitted for an on-track goal', () => {
    const kinds = recs([lagging({ contributed: 2000, remaining: 3490 })]).map(
      (r) => r.kind
    );
    expect(kinds).not.toContain('behind');
    expect(kinds).toContain('monthly-pace');
  });

  it('emits at most one of behind and monthly-pace per goal', () => {
    const list = recs([lagging()]).filter((r) => r.goalId === 'reno');
    const kinds = list.map((r) => r.kind);
    expect(
      kinds.filter((k) => k === 'behind' || k === 'monthly-pace')
    ).toHaveLength(1);
  });
});

describe('recommendation: monthly-pace', () => {
  it('reports the goal own monthly figure and its date', () => {
    const r = recs([
      steady({
        id: 'g',
        name: 'Wedding',
        targetDate: '2027-01-15',
        targetAmount: 12000,
        share: 0.5,
      }),
    ]).find((x) => x.kind === 'monthly-pace');
    expect(r).toMatchObject({
      goalId: 'g',
      label: 'Wedding',
      amounts: { monthly: 475 },
      dates: { target: '2027-01-15' },
    });
  });

  it('falls back to the last dated entry for a goal with only dated items', () => {
    const r = recs([
      goal({
        id: 'g',
        targetAmount: 1000,
        remaining: 1000,
        items: [item({ id: 'a', effective: 1000, dueDate: '2027-01-15' })],
      }),
    ]).find((x) => x.kind === 'monthly-pace');
    expect(r).toMatchObject({ dates: { target: '2027-01-15' } });
  });
});

describe('recommendation: covered', () => {
  it('emits only covered when the surplus covers the whole goal', () => {
    const list = recs([wedding()], 23000);
    expect(list).toEqual([
      {
        kind: 'covered',
        goalId: 'wedding',
        label: 'Wedding',
        amounts: { covered: 23000 },
        dates: {},
      },
    ]);
  });

  it('suppresses behind for a behind goal that is fully covered', () => {
    const g = goal({
      id: 'reno',
      createdAt: '2025-07-15',
      targetDate: '2027-01-15',
      targetAmount: 5490,
      contributed: 1000,
      remaining: 4490,
      share: 0.5,
    });
    const list = recs([g], 2245);
    expect(list.map((r) => r.kind)).toEqual(['covered']);
  });

  it('never appears with surplus 0 (household page)', () => {
    expect(recs([wedding()], 0).some((r) => r.kind === 'covered')).toBe(false);
  });

  it('is silent for a funded goal', () => {
    const funded = goal({
      id: 'f',
      targetDate: D18,
      targetAmount: 500,
      contributed: 500,
      remaining: 0,
    });
    expect(recs([funded], 1000)).toEqual([]);
  });
});

describe('recommendation: shortfall', () => {
  it('is emitted only for a positive shortfall', () => {
    expect(recs([], 0, 0)).toEqual([]);
    expect(recs([], 0, undefined)).toEqual([]);
    expect(recs([], 0, 80)).toEqual([
      {
        kind: 'shortfall',
        goalId: null,
        label: null,
        amounts: { shortfall: 80 },
        dates: {},
      },
    ]);
  });
});

describe('recommendation: missing-data', () => {
  const undated = (id: string, over: Partial<PlanGoal> = {}) =>
    goal({ id, targetAmount: 100, remaining: 100, ...over });

  it('emits one item counting undated, unfunded goals with a share', () => {
    const list = recs([
      undated('a'),
      undated('b'),
      undated('c', { share: 0 }),
      undated('d', { remaining: 0 }),
      undated('e', {
        items: [item({ id: 'i', effective: 100, dueDate: D18 })],
      }),
    ]).filter((r) => r.kind === 'missing-data');
    expect(list).toEqual([
      {
        kind: 'missing-data',
        goalId: null,
        label: null,
        amounts: { count: 2 },
        dates: {},
      },
    ]);
  });

  it('contributes nothing to the plan', () => {
    expect(plan([undated('a')]).monthly).toBe(0);
  });
});

describe('recommendation ordering', () => {
  it('orders kinds, then dates, amounts and goal ids', () => {
    const sooner = steady({
      id: 'b',
      targetDate: '2026-02-15',
      targetAmount: 100,
    });
    const later = steady({
      id: 'a',
      targetDate: '2026-03-15',
      targetAmount: 100,
    });
    const behindBig = goal({
      id: 'big',
      createdAt: '2025-07-15',
      targetDate: '2027-01-15',
      targetAmount: 5490,
      contributed: 0,
      remaining: 5490,
    });
    const behindSmall = goal({
      id: 'small',
      createdAt: '2025-07-15',
      targetDate: '2027-01-15',
      targetAmount: 5490,
      contributed: 1500,
      remaining: 3990,
    });
    const pace2 = steady({ id: 'p2', targetDate: '2028-01-15' });
    const pace1 = steady({ id: 'p1', targetDate: '2027-06-15' });
    const covered = goal({
      id: 'cov',
      targetDate: '2026-01-20',
      targetAmount: 1,
      remaining: 1,
    });
    const missing = goal({ id: 'm', targetAmount: 10, remaining: 10 });

    const list = recs(
      [missing, covered, pace2, pace1, behindSmall, behindBig, later, sooner],
      1,
      25
    );
    expect(list.map((r) => `${r.kind}:${r.goalId ?? ''}`)).toEqual([
      'shortfall:',
      'next-payment:b',
      'next-payment:a',
      'behind:big',
      'behind:small',
      'monthly-pace:b',
      'monthly-pace:a',
      'monthly-pace:p1',
      'monthly-pace:p2',
      'covered:cov',
      'missing-data:',
    ]);
  });

  it('breaks ties by goal id regardless of input order', () => {
    const mk = (id: string) =>
      goal({
        id,
        targetDate: '2026-03-15',
        targetAmount: 100,
        remaining: 100,
      });
    const forward = recs([mk('a'), mk('b')]).map((r) => r.goalId);
    const backward = recs([mk('b'), mk('a')]).map((r) => r.goalId);
    expect(forward).toEqual(backward);
    expect(forward.slice(0, 2)).toEqual(['a', 'b']);
  });

  it('exposes the full list without a cap', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      goal({
        id: `g${i}`,
        targetDate: '2026-03-15',
        targetAmount: 100,
        remaining: 100,
      })
    );
    expect(recs(many).length).toBeGreaterThan(3);
  });
});

describe('household page (surplus 0)', () => {
  it('offsets nothing and shows the same figures as the caller plan', () => {
    const p = plan([wedding()], 0);
    expect(p.surplusUsed).toBe(0);
    expect(p.perGoal[0].scheduleTotal).toBe(23000);
    const share1 = plan([wedding({ share: 1 })], 0);
    expect(share1.schedule.reduce((s, e) => s + e.amount, 0)).toBe(46000);
  });
});

describe('input hardening', () => {
  const datedGoal = (over: Partial<PlanGoal>) =>
    goal({
      id: 'g',
      targetDate: '2026-06-15',
      targetAmount: 1000,
      remaining: 1000,
      ...over,
    });

  function expectSane(plan: ReturnType<typeof computeHouseholdPlan>) {
    for (const n of [
      plan.monthly,
      plan.goalsMonthly,
      plan.budgetsMonthly,
      plan.surplusUsed,
    ]) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
    for (const e of plan.schedule) {
      expect(Number.isFinite(e.amount)).toBe(true);
      expect(e.amount).toBeGreaterThan(0);
    }
    for (const g of plan.perGoal) {
      expect(Number.isFinite(g.scheduleTotal)).toBe(true);
      expect(Number.isFinite(g.monthly)).toBe(true);
    }
  }

  it.each([NaN, -50])('survives remaining %s', (remaining) => {
    const plan = computeHouseholdPlan(
      { goals: [datedGoal({ remaining })], budgets: [] },
      { surplus: 0, now: NOW }
    );
    expectSane(plan);
    expect(plan.schedule).toEqual([]);
  });

  it.each([NaN, -50])('survives targetAmount %s', (targetAmount) => {
    const plan = computeHouseholdPlan(
      { goals: [datedGoal({ targetAmount })], budgets: [] },
      { surplus: 0, now: NOW }
    );
    expectSane(plan);
  });

  it.each([NaN, -300])('survives item effective %s', (effective) => {
    const plan = computeHouseholdPlan(
      {
        goals: [
          datedGoal({
            items: [item({ id: 'i', effective, dueDate: '2026-03-15' })],
          }),
        ],
        budgets: [],
      },
      { surplus: 0, now: NOW }
    );
    expectSane(plan);
  });

  it('treats NaN and negative paid as nothing paid, and caps paid at effective', () => {
    const run = (paid: number) =>
      computeHouseholdPlan(
        {
          goals: [
            datedGoal({
              items: [
                item({
                  id: 'i',
                  effective: 1000,
                  paid,
                  dueDate: '2026-03-15',
                }),
              ],
            }),
          ],
          budgets: [],
        },
        { surplus: 0, now: NOW }
      );
    expect(run(NaN).schedule[0]?.amount).toBe(1000);
    expect(run(-100).schedule[0]?.amount).toBe(1000);
    expect(run(5000).schedule).toEqual([]);
    expectSane(run(NaN));
    expectSane(run(-100));
  });

  it.each([NaN, -500])('survives budget monthlyAmount %s', (monthlyAmount) => {
    const plan = computeHouseholdPlan(
      { goals: [], budgets: [{ id: 'b', monthlyAmount, share: 1 }] },
      { surplus: 0, now: NOW }
    );
    expectSane(plan);
    expect(plan.budgetsMonthly).toBe(0);
  });

  it.each([NaN, -1])('survives budget share %s', (share) => {
    const plan = computeHouseholdPlan(
      { goals: [], budgets: [{ id: 'b', monthlyAmount: 500, share }] },
      { surplus: 0, now: NOW }
    );
    expectSane(plan);
    expect(plan.budgetsMonthly).toBe(0);
  });

  it.each([NaN, -1])('drops a goal with share %s', (share) => {
    const plan = computeHouseholdPlan(
      { goals: [datedGoal({ share })], budgets: [] },
      { surplus: 0, now: NOW }
    );
    expect(plan.schedule).toEqual([]);
    expectSane(plan);
  });

  it('clamps share above 1 so the schedule never exceeds remaining', () => {
    const plan = computeHouseholdPlan(
      {
        goals: [datedGoal({ share: 1.5 })],
        budgets: [{ id: 'b', monthlyAmount: 200, share: 2 }],
      },
      { surplus: 0, now: NOW }
    );
    expect(plan.perGoal[0]?.scheduleTotal).toBe(1000);
    expect(plan.budgetsMonthly).toBe(200);
  });

  it.each([NaN, -100])('treats surplus %s as 0', (surplus) => {
    const plan = computeHouseholdPlan(
      { goals: [datedGoal({})], budgets: [] },
      { surplus, now: NOW }
    );
    expect(plan.surplusUsed).toBe(0);
    expectSane(plan);
  });
});

describe('month boundaries', () => {
  const run = (now: Date, targetDate: string) =>
    computeHouseholdPlan(
      {
        goals: [
          goal({ id: 'g', targetDate, targetAmount: 1200, remaining: 1200 }),
        ],
        budgets: [],
      },
      { surplus: 0, now }
    );

  it('counts 2026-01-31 to 2026-02-28 as one month', () => {
    const plan = run(new Date(2026, 0, 31), '2026-02-28');
    expect(plan.bindingMonths).toBe(1);
    expect(plan.goalsMonthly).toBe(1200);
  });

  it('counts 2026-01-30 to 2026-03-01 as two months', () => {
    const plan = run(new Date(2026, 0, 30), '2026-03-01');
    expect(plan.bindingMonths).toBe(2);
    expect(plan.goalsMonthly).toBe(600);
  });

  it('has no off-by-one on the first and last day of a month', () => {
    expect(run(new Date(2026, 0, 1, 23, 59), '2026-01-31').bindingMonths).toBe(
      1
    );
    expect(run(new Date(2026, 0, 31, 0, 1), '2026-03-01').bindingMonths).toBe(
      2
    );
    const exact = run(new Date(2026, 0, 1, 12), '2026-04-01');
    expect(exact.bindingMonths).toBe(3);
    expect(exact.goalsMonthly).toBe(400);
    expect(run(new Date(2026, 0, 1, 12), '2026-04-02').bindingMonths).toBe(4);
  });
});
