import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { goalStatus, monthsUntil } from './goal-stats';

export interface PlanItem {
  id: string;
  name: string;
  /** quote ?? budget */
  effective: number;
  paid: number;
  dueDate: string | null;
}

export interface PlanGoal {
  id: string;
  name: string;
  targetDate: string | null;
  createdAt: string;
  targetAmount: number;
  contributed: number;
  remaining: number;
  /** Caller's fraction of this goal, 0 to 1. */
  share: number;
  items: PlanItem[];
}

export interface PlanBudget {
  id: string;
  monthlyAmount: number;
  /** Caller's fraction of this budget, 0 to 1. */
  share: number;
}

export interface HouseholdPlanInput {
  state: 'none' | 'locked' | 'ready';
  isDefaultSplit: boolean;
  callerShares: { default: number };
  goals: PlanGoal[];
  budgets: PlanBudget[];
}

export interface ScheduleEntry {
  goalId: string;
  itemId: string | null;
  label: string;
  date: string;
  /** Caller's share, after the surplus offset. */
  amount: number;
}

export interface GoalPlan {
  goalId: string;
  /** After the surplus offset; add `surplusUsed` for the amount before it. */
  scheduleTotal: number;
  surplusUsed: number;
  /** The tightest-deadline figure for this goal's entries alone. */
  monthly: number;
}

export interface HouseholdPlan {
  monthly: number;
  goalsMonthly: number;
  budgetsMonthly: number;
  /** Months to the deadline that sets `goalsMonthly`; null when it is 0. */
  bindingMonths: number | null;
  surplusUsed: number;
  schedule: ScheduleEntry[];
  perGoal: GoalPlan[];
}

export interface PlanOptions {
  /** Savings above emergency fund and war chest, treated as already set aside. */
  surplus: number;
  now: Date;
}

interface Entry extends ScheduleEntry {
  order: number;
}

const dayOf = (iso: string) => iso.slice(0, 10);

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function dueAscending(a: Entry, b: Entry): number {
  return byId(a.date, b.date) || byId(a.goalId, b.goalId) || a.order - b.order;
}

/**
 * Contributions are household money that pays the earliest bills first, so the
 * remaining total is placed from the latest date backwards; the earliest
 * entries are the ones the pot already covers or that get trimmed.
 */
function placeGoal(goal: PlanGoal, startOrder: number): Entry[] {
  const remaining = Math.max(0, goal.remaining);
  if (remaining <= 0 || goal.share <= 0) return [];
  const targetDate = goal.targetDate ? dayOf(goal.targetDate) : null;

  const raw: Omit<Entry, 'order'>[] = [];
  let itemTotal = 0;
  for (const item of goal.items) {
    itemTotal += item.effective;
    const unpaid = Math.max(0, item.effective - item.paid);
    const date = item.dueDate ? dayOf(item.dueDate) : targetDate;
    if (unpaid <= 0 || date === null) continue;
    raw.push({
      goalId: goal.id,
      itemId: item.id,
      label: item.name,
      date,
      amount: unpaid,
    });
  }
  const balance = goal.targetAmount - itemTotal;
  if (balance > 0 && targetDate !== null) {
    raw.push({
      goalId: goal.id,
      itemId: null,
      label: goal.name,
      date: targetDate,
      amount: balance,
    });
  }

  let left = remaining;
  const placed: Entry[] = [];
  const latestFirst = raw
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => byId(b.entry.date, a.entry.date) || a.index - b.index);
  for (const { entry, index } of latestFirst) {
    const amount = Math.min(entry.amount, left);
    if (amount <= 0) continue;
    left -= amount;
    placed.push({
      ...entry,
      amount: amount * goal.share,
      order: startOrder + index,
    });
  }
  return placed;
}

/**
 * `max over deadlines of cumulative due / months`, with overdue and
 * this-month deadlines counting as one month. Entries must be date ascending.
 */
function tightestDeadline(
  entries: readonly { date: string; amount: number }[],
  now: Date
): { monthly: number; bindingMonths: number | null } {
  let cumulative = 0;
  let monthly = 0;
  let bindingMonths: number | null = null;
  entries.forEach((entry, i) => {
    cumulative += entry.amount;
    const next = entries[i + 1];
    if (next && next.date === entry.date) return;
    const months = monthsUntil(entry.date, now) ?? 1;
    const need = cumulative / months;
    if (need > monthly) {
      monthly = need;
      bindingMonths = months;
    }
  });
  return { monthly, bindingMonths };
}

/** Whether the goal has any date the planner can place an entry on. */
function isUndated(goal: PlanGoal): boolean {
  return goal.targetDate === null && goal.items.every((i) => !i.dueDate);
}

export function computeHouseholdPlan(
  input: Pick<HouseholdPlanInput, 'goals' | 'budgets'>,
  options: PlanOptions
): HouseholdPlan {
  const { now } = options;
  const surplus = Number.isFinite(options.surplus)
    ? Math.max(0, options.surplus)
    : 0;

  const planned = input.goals.filter((g) => g.share > 0);
  let order = 0;
  const entries: Entry[] = [];
  for (const goal of planned) {
    const placed = placeGoal(goal, order);
    order += goal.items.length + 1;
    entries.push(...placed);
  }
  entries.sort(dueAscending);

  let left = surplus;
  const usedByGoal = new Map<string, number>();
  const offset: Entry[] = [];
  for (const entry of entries) {
    const used = Math.min(entry.amount, left);
    left -= used;
    if (used > 0) {
      usedByGoal.set(entry.goalId, (usedByGoal.get(entry.goalId) ?? 0) + used);
    }
    const amount = entry.amount - used;
    if (amount > 0) offset.push({ ...entry, amount });
  }

  const overall = tightestDeadline(offset, now);
  const perGoal: GoalPlan[] = planned.map((goal) => {
    const own = offset.filter((e) => e.goalId === goal.id);
    return {
      goalId: goal.id,
      scheduleTotal: own.reduce((sum, e) => sum + e.amount, 0),
      surplusUsed: usedByGoal.get(goal.id) ?? 0,
      monthly: tightestDeadline(own, now).monthly,
    };
  });

  const budgetsMonthly = input.budgets.reduce(
    (sum, b) => sum + b.share * b.monthlyAmount,
    0
  );

  return {
    monthly: overall.monthly + budgetsMonthly,
    goalsMonthly: overall.monthly,
    budgetsMonthly,
    bindingMonths: overall.bindingMonths,
    surplusUsed: surplus - left,
    schedule: offset.map(({ goalId, itemId, label, date, amount }) => ({
      goalId,
      itemId,
      label,
      date,
      amount,
    })),
    perGoal,
  };
}

export type RecommendationKind =
  | 'shortfall'
  | 'next-payment'
  | 'behind'
  | 'monthly-pace'
  | 'covered'
  | 'missing-data';

interface Rec<K extends RecommendationKind, A, D> {
  kind: K;
  goalId: string | null;
  /** Item name for a next payment, goal name for the goal-level kinds. */
  label: string | null;
  amounts: A;
  dates: D;
}

type NoDates = Record<string, never>;

export type HouseholdRecommendation =
  | Rec<'shortfall', { shortfall: number }, NoDates>
  | Rec<'next-payment', { amount: number }, { due: string }>
  | Rec<
      'behind',
      { behind: number; catchUpPerMonth: number },
      { target: string }
    >
  | Rec<'monthly-pace', { monthly: number }, { target: string | null }>
  | Rec<'covered', { covered: number }, NoDates>
  | Rec<'missing-data', { count: number }, NoDates>;

export interface RecommendationOptions {
  now: Date;
  /** Planner only: this month's household share beyond what is left. */
  shortfallPerMonth?: number;
}

export const NEXT_PAYMENT_DAYS = 90;

/** Straight-line amount the goal should hold by `now`; the full target once overdue. */
function expectedSaved(goal: PlanGoal, targetDate: string, now: Date): number {
  const today = startOfDay(now);
  const target = parseISO(dayOf(targetDate));
  if (target < today) return goal.targetAmount;
  const created = parseISO(dayOf(goal.createdAt));
  const total = Math.max(1, differenceInCalendarDays(target, created));
  const elapsed = Math.max(1, differenceInCalendarDays(today, created));
  return (goal.targetAmount * Math.min(elapsed, total)) / total;
}

export function householdRecommendations(
  input: Pick<HouseholdPlanInput, 'goals'>,
  plan: HouseholdPlan,
  options: RecommendationOptions
): HouseholdRecommendation[] {
  const { now, shortfallPerMonth = 0 } = options;
  const today = startOfDay(now);
  const perGoal = new Map(plan.perGoal.map((g) => [g.goalId, g]));

  const nextPayments: HouseholdRecommendation[] = [];
  const behinds: HouseholdRecommendation[] = [];
  const paces: HouseholdRecommendation[] = [];
  const covers: HouseholdRecommendation[] = [];
  let missing = 0;

  const goals = input.goals
    .filter((g) => g.share > 0)
    .sort((a, b) => byId(a.id, b.id));

  for (const goal of goals) {
    if (Math.max(0, goal.remaining) <= 0) continue;
    if (isUndated(goal)) {
      missing += 1;
      continue;
    }
    const figures = perGoal.get(goal.id);
    if (!figures) continue;

    if (figures.scheduleTotal <= 0 && figures.surplusUsed > 0) {
      covers.push({
        kind: 'covered',
        goalId: goal.id,
        label: goal.name,
        amounts: { covered: figures.surplusUsed },
        dates: {},
      });
      continue;
    }

    const own = plan.schedule
      .filter((e) => e.goalId === goal.id)
      .sort((a, b) => byId(a.date, b.date) || byId(a.label, b.label));
    const first = own[0];
    if (
      first &&
      differenceInCalendarDays(parseISO(first.date), today) <= NEXT_PAYMENT_DAYS
    ) {
      nextPayments.push({
        kind: 'next-payment',
        goalId: goal.id,
        label: first.label,
        amounts: { amount: first.amount },
        dates: { due: first.date },
      });
    }

    const { targetDate } = goal;
    let behindEmitted = false;
    if (targetDate !== null && goalStatus(goal, now) === 'behind') {
      const behind =
        (expectedSaved(goal, targetDate, now) - goal.contributed) * goal.share -
        figures.surplusUsed;
      if (behind > 0) {
        behindEmitted = true;
        behinds.push({
          kind: 'behind',
          goalId: goal.id,
          label: goal.name,
          amounts: {
            behind,
            catchUpPerMonth: behind / (monthsUntil(targetDate, now) ?? 1),
          },
          dates: { target: dayOf(targetDate) },
        });
      }
    }

    if (!behindEmitted && figures.monthly > 0) {
      paces.push({
        kind: 'monthly-pace',
        goalId: goal.id,
        label: goal.name,
        amounts: { monthly: figures.monthly },
        dates: {
          target: targetDate
            ? dayOf(targetDate)
            : (own[own.length - 1]?.date ?? null),
        },
      });
    }
  }

  const goalOf = (r: HouseholdRecommendation) => r.goalId ?? '';
  const dueOf = (r: HouseholdRecommendation) =>
    r.kind === 'next-payment' ? r.dates.due : '';
  const paceDateOf = (r: HouseholdRecommendation) =>
    r.kind === 'monthly-pace' ? (r.dates.target ?? '9999-12-31') : '';
  const behindOf = (r: HouseholdRecommendation) =>
    r.kind === 'behind' ? r.amounts.behind : 0;

  nextPayments.sort(
    (a, b) => byId(dueOf(a), dueOf(b)) || byId(goalOf(a), goalOf(b))
  );
  behinds.sort(
    (a, b) => behindOf(b) - behindOf(a) || byId(goalOf(a), goalOf(b))
  );
  paces.sort(
    (a, b) => byId(paceDateOf(a), paceDateOf(b)) || byId(goalOf(a), goalOf(b))
  );

  const result: HouseholdRecommendation[] = [];
  if (shortfallPerMonth > 0) {
    result.push({
      kind: 'shortfall',
      goalId: null,
      label: null,
      amounts: { shortfall: shortfallPerMonth },
      dates: {},
    });
  }
  result.push(...nextPayments, ...behinds, ...paces, ...covers);
  if (missing > 0) {
    result.push({
      kind: 'missing-data',
      goalId: null,
      label: null,
      amounts: { count: missing },
      dates: {},
    });
  }
  return result;
}
