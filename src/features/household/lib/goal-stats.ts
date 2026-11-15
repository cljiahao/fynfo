import { formatSGD } from '@/lib/utils/currency';
import { addMonths } from 'date-fns/addMonths';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { differenceInMonths } from 'date-fns/differenceInMonths';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { ITEM_BAR_CAP, NO_ITEMS_SUMMARY } from '../constants';
import type { GoalItem, HouseholdGoal } from '../types';
import { computeItemBudget } from './project-budget';

/**
 * Whole months from `now` to the target date, partial months rounded up, never
 * below 1. Returns `null` when the date has already passed.
 */
export function monthsUntil(targetDate: string, now: Date): number | null {
  const today = startOfDay(now);
  const target = parseISO(targetDate.slice(0, 10));
  if (target < today) return null;
  const whole = differenceInMonths(target, today);
  const months = addMonths(today, whole) < target ? whole + 1 : whole;
  return Math.max(1, months);
}

/**
 * Amount to set aside per month to reach the target by its date, or `null`
 * when there is nothing to pace (no date, or already funded). `'past'` means
 * the date has gone by while the goal is still short. Partial months count as
 * whole ones so the figure never understates what is needed.
 */
export function monthlyPaceNeeded(
  goal: Pick<HouseholdGoal, 'targetDate' | 'remaining'>,
  now: Date
): number | 'past' | null {
  if (!goal.targetDate || goal.remaining <= 0) return null;
  const months = monthsUntil(goal.targetDate, now);
  if (months === null) return 'past';
  return goal.remaining / months;
}

/**
 * What a goal shows for its share of the monthly plan. A goal with a target
 * date shows its slice (including zero) unless it is funded; one without a
 * date shows a slice only when the plan schedules something for it. Without a
 * plan figure (loading, locked, errored) nothing is shown, never a standalone
 * pace that would disagree with the plan.
 */
export function goalPlanShare(
  goal: Pick<HouseholdGoal, 'targetDate' | 'remaining'>,
  now: Date,
  monthly: number | null
): number | 'past' | null {
  const dated = monthlyPaceNeeded(goal, now);
  if (dated === 'past') return 'past';
  if (monthly === null) return null;
  if (goal.targetDate) return dated === null ? null : monthly;
  return monthly > 0 ? monthly : null;
}

export interface CumulativePoint {
  date: string;
  total: number;
}

/** Running total per calendar day, oldest first; same-day entries merge. */
export function cumulativeContributions(
  goal: Pick<HouseholdGoal, 'contributions'>
): CumulativePoint[] {
  const byDay = new Map<string, number>();
  for (const contribution of goal.contributions) {
    const day = contribution.date.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + contribution.amount);
  }
  let running = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, amount]) => {
      running += amount;
      return { date, total: running };
    });
}

export interface ActivityEntry {
  id: string;
  kind: 'contribution' | 'payment';
  amount: number;
  date: string;
  isSelf: boolean;
  /** Item the payment went to; null for contributions. */
  itemName: string | null;
}

/** Contributions and item payments merged, newest first. */
export function recentActivity(
  goal: Pick<HouseholdGoal, 'contributions' | 'items'>,
  limit: number
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...goal.contributions.map((c) => ({
      id: c.id,
      kind: 'contribution' as const,
      amount: c.amount,
      date: c.date,
      isSelf: c.isSelf,
      itemName: null,
    })),
    ...goal.items.flatMap((item) =>
      item.payments.map((p) => ({
        id: p.id,
        kind: 'payment' as const,
        amount: p.amount,
        date: p.date,
        isSelf: p.isSelf,
        itemName: item.name,
      }))
    ),
  ];
  return entries
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, limit);
}

/** One-line card summary; `mask` hides the amounts while privacy is on. */
export function summarizeBreakdown(
  goal: Pick<HouseholdGoal, 'items' | 'paid' | 'budgeted'>,
  mask: (value: string) => string
): { text: string; over: boolean } {
  const count = goal.items.length;
  if (count === 0) return { text: NO_ITEMS_SUMMARY, over: false };
  return {
    text: `${count} item${count === 1 ? '' : 's'} · ${mask(formatSGD(goal.paid))} of ${mask(formatSGD(goal.budgeted))}`,
    over: goal.paid > goal.budgeted,
  };
}

/** Drops rows still inside their undo window so totals match what is shown. */
export function withoutPending(
  goal: HouseholdGoal,
  pendingIds: ReadonlySet<string>
): HouseholdGoal {
  if (pendingIds.size === 0) return goal;
  const items = goal.items
    .filter((item) => !pendingIds.has(item.id))
    .map((item) => {
      const payments = item.payments.filter((p) => !pendingIds.has(p.id));
      if (payments.length === item.payments.length) return item;
      return {
        ...item,
        payments,
        ...computeItemBudget(
          item.budget,
          payments.map((p) => p.amount)
        ),
      };
    });
  return {
    ...goal,
    items,
    budgeted: items.reduce((sum, item) => sum + item.budget, 0),
    paid: items.reduce((sum, item) => sum + item.paid, 0),
  };
}

/** What an item is expected to cost: the final quote once there is one, else the estimate. */
export function effectiveAmount(item: Pick<GoalItem, 'budget' | 'quote'>) {
  return item.quote ?? item.budget;
}

/** Still-to-pay across items; overpaid items contribute nothing, not a credit. */
export function goalCommitted(goal: Pick<HouseholdGoal, 'items'>): number {
  return goal.items.reduce(
    (sum, item) => sum + Math.max(0, effectiveAmount(item) - item.paid),
    0
  );
}

export type GoalStatus = 'funded' | 'no-date' | 'on-track' | 'behind';

export type GoalBasis = 'saved' | 'paid';

const toCents = (amount: number) => Math.round(amount * 100);

const DAY_FORMAT = 'yyyy-MM-dd';

/** What every item is expected to cost together: quotes replace estimates. */
export function plannedTotal(goal: Pick<HouseholdGoal, 'items'>): number {
  return goal.items.reduce((sum, item) => sum + effectiveAmount(item), 0);
}

/** Items-first goals are tracked by payments until the first contribution arrives. */
export function goalBasis(
  goal: Pick<HouseholdGoal, 'contributed' | 'items'>
): GoalBasis {
  return goal.contributed <= 0 && plannedTotal(goal) > 0 ? 'paid' : 'saved';
}

/**
 * `goalPlanShare` for whichever basis the goal leads with: in the paid basis
 * the amount still to pay stands in for `remaining`, so a goal with every item
 * paid never reads "Past target date" just because nothing was contributed.
 */
export function goalPace(
  goal: Pick<
    HouseholdGoal,
    'targetDate' | 'remaining' | 'contributed' | 'items'
  >,
  now: Date,
  monthly: number | null
): number | 'past' | null {
  const remaining =
    goalBasis(goal) === 'paid' ? goalCommitted(goal) : goal.remaining;
  return goalPlanShare(
    { targetDate: goal.targetDate, remaining },
    now,
    monthly
  );
}

/** Items are all paid once nothing is left to pay, compared in whole cents. */
function paidInFull(goal: Pick<HouseholdGoal, 'items'>): boolean {
  return toCents(goalCommitted(goal)) === 0;
}

/** Each item falls due on its own date, else the goal's date. */
function itemDueDate(
  item: Pick<GoalItem, 'dueDate'>,
  targetDate: string | null
): string | null {
  const due = item.dueDate ?? targetDate;
  return due ? due.slice(0, 10) : null;
}

/** Status for the paid basis: payments against what the items say is due. */
function paidStatus(
  goal: Pick<HouseholdGoal, 'targetDate' | 'items'>,
  now: Date
): GoalStatus {
  if (paidInFull(goal)) return 'funded';
  const today = format(startOfDay(now), DAY_FORMAT);
  const overdue = goal.items.some((item) => {
    const due = itemDueDate(item, goal.targetDate);
    return (
      due !== null &&
      due < today &&
      toCents(item.paid) < toCents(effectiveAmount(item))
    );
  });
  if (overdue) return 'behind';
  const anyDue = goal.items.some(
    (item) => itemDueDate(item, goal.targetDate) !== null
  );
  return anyDue ? 'on-track' : 'no-date';
}

/**
 * Funded, undated, or on track against a straight line from creation to the
 * target date, measured by contributions. Compared in whole cents so float
 * noise never flips the chip.
 */
export function savedStatus(
  goal: Pick<
    HouseholdGoal,
    'targetAmount' | 'targetDate' | 'createdAt' | 'contributed' | 'remaining'
  >,
  now: Date
): GoalStatus {
  // A corrupt target or total must never read as a finished goal.
  const sound =
    Number.isFinite(goal.targetAmount) &&
    goal.targetAmount > 0 &&
    Number.isFinite(goal.contributed);
  if (sound && goal.remaining <= 0) return 'funded';
  if (!goal.targetDate) return 'no-date';
  const today = startOfDay(now);
  const target = parseISO(goal.targetDate.slice(0, 10));
  if (target < today) return 'behind';
  const created = parseISO(goal.createdAt.slice(0, 10));
  const total = Math.max(1, differenceInCalendarDays(target, created));
  const elapsed = Math.max(1, differenceInCalendarDays(today, created));
  const expected = (goal.targetAmount * Math.min(elapsed, total)) / total;
  return toCents(goal.contributed) >= toCents(expected) ? 'on-track' : 'behind';
}

/**
 * What the chip shows. Goals run through items (no contributions) compare
 * payments with item due dates; every other goal uses `savedStatus`.
 */
export function goalStatus(
  goal: Pick<
    HouseholdGoal,
    | 'targetAmount'
    | 'targetDate'
    | 'createdAt'
    | 'contributed'
    | 'remaining'
    | 'items'
  >,
  now: Date
): GoalStatus {
  return goalBasis(goal) === 'paid'
    ? paidStatus(goal, now)
    : savedStatus(goal, now);
}

export type GoalDeadline =
  | { kind: 'none' }
  | { kind: 'funded'; date: string }
  | { kind: 'overdue'; date: string; days: number }
  | { kind: 'upcoming'; date: string; days: number };

/**
 * Deadline facts for the goal header. Funded is decided exactly as in
 * `goalStatus`, so the chip and the deadline line never disagree; `days` are
 * whole calendar days.
 */
export function goalDeadline(
  goal: Pick<
    HouseholdGoal,
    'targetDate' | 'remaining' | 'targetAmount' | 'contributed' | 'items'
  >,
  now: Date
): GoalDeadline {
  if (!goal.targetDate) return { kind: 'none' };
  const date = goal.targetDate.slice(0, 10);
  if (goalBasis(goal) === 'paid') {
    if (paidInFull(goal)) return { kind: 'funded', date };
  } else {
    const sound =
      Number.isFinite(goal.targetAmount) &&
      goal.targetAmount > 0 &&
      Number.isFinite(goal.contributed);
    if (sound && goal.remaining <= 0) return { kind: 'funded', date };
  }
  const days = differenceInCalendarDays(parseISO(date), startOfDay(now));
  return days < 0
    ? { kind: 'overdue', date, days: -days }
    : { kind: 'upcoming', date, days };
}

export interface BreakdownSegment {
  id: string;
  name: string;
  /** What the segment is sized by: quote ?? estimate. */
  effective: number;
  /** Paid so far, clamped to `effective` so the shaded part never overflows. */
  paid: number;
  /** Names folded into an "Other" bucket; null for a single item. */
  names: string[] | null;
}

export interface ItemBreakdown {
  segments: BreakdownSegment[];
  /** Sum of every item's effective amount. */
  total: number;
  /** Width of the bar: the target, or the items total when that is larger. */
  scale: number;
  /** Target not yet claimed by an item. */
  unallocated: number;
  /** Saved plus still-to-pay exceeds the target. */
  overCommitted: boolean;
}

/**
 * Largest items first, at most `cap` of them; the rest collapse into one
 * "Other" bucket so the bar stays readable on a phone.
 */
export function breakdownSegments(
  goal: Pick<HouseholdGoal, 'items' | 'targetAmount' | 'contributed'>,
  cap: number = ITEM_BAR_CAP
): ItemBreakdown {
  const sized = goal.items
    .map((item) => ({
      id: item.id,
      name: item.name,
      effective: effectiveAmount(item),
      paid: Math.min(item.paid, effectiveAmount(item)),
    }))
    .filter((item) => item.effective > 0)
    .sort((a, b) => b.effective - a.effective);
  const shown: BreakdownSegment[] = sized
    .slice(0, cap)
    .map((item) => ({ ...item, names: null }));
  const rest = sized.slice(cap);
  if (rest.length > 0) {
    shown.push({
      id: 'other',
      name: 'Other',
      effective: rest.reduce((sum, item) => sum + item.effective, 0),
      paid: rest.reduce((sum, item) => sum + item.paid, 0),
      names: rest.map((item) => item.name),
    });
  }
  const total = sized.reduce((sum, item) => sum + item.effective, 0);
  return {
    segments: shown,
    total,
    scale: Math.max(goal.targetAmount, total),
    unallocated: Math.max(0, goal.targetAmount - total),
    overCommitted: goal.contributed + goalCommitted(goal) > goal.targetAmount,
  };
}

export interface BurnUpRow {
  date: string;
  /** Cumulative saved; null where only the pace line has a point. */
  saved: number | null;
  /** Straight-line pace; null outside start..target date. */
  needed: number | null;
}

/**
 * Cumulative saved against the straight pace needed to hit the target by its
 * date. The pace line runs from the first contribution (or creation when there
 * are none) to the target date and stops there; saved continues to today.
 */
export function burnUpSeries(
  goal: Pick<
    HouseholdGoal,
    'contributions' | 'createdAt' | 'targetDate' | 'targetAmount'
  >,
  now: Date
): BurnUpRow[] {
  const saved = cumulativeContributions(goal);
  const created = goal.createdAt.slice(0, 10);
  const start =
    saved.length > 0 && saved[0].date < created ? saved[0].date : created;
  const today = format(now, DAY_FORMAT);
  const rows = new Map<string, BurnUpRow>();
  const row = (date: string) => {
    const existing = rows.get(date);
    if (existing) return existing;
    const added: BurnUpRow = { date, saved: null, needed: null };
    rows.set(date, added);
    return added;
  };

  if (saved.length === 0 || saved[0].date > start) row(start).saved = 0;
  for (const point of saved) row(point.date).saved = point.total;
  const last =
    saved.length > 0 ? saved[saved.length - 1] : { date: start, total: 0 };
  if (today > last.date) row(today).saved = last.total;

  const end = goal.targetDate?.slice(0, 10);
  if (end && end >= start) {
    row(start).needed = 0;
    row(end).needed = goal.targetAmount;
  }
  return [...rows.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
}

export interface PaidRow {
  date: string;
  /** Cumulative paid; null where only the due line has a point. */
  paid: number | null;
  /** Cumulative amount due by this date; null where only paid has a point. */
  due: number | null;
}

/**
 * Cumulative item payments against the cumulative cost of items by their due
 * date. Paid runs from the start to today; the due line is a step function
 * that ends at the cost of the dated items, so it is exactly what the status
 * chip compares payments with.
 */
export function paidSeries(
  goal: Pick<HouseholdGoal, 'items' | 'createdAt' | 'targetDate'>,
  now: Date
): PaidRow[] {
  const paidByDay = new Map<string, number>();
  for (const item of goal.items) {
    for (const payment of item.payments) {
      const day = payment.date.slice(0, 10);
      paidByDay.set(day, (paidByDay.get(day) ?? 0) + payment.amount);
    }
  }
  const paidDays = [...paidByDay.keys()].sort();
  const created = goal.createdAt.slice(0, 10);
  const start =
    paidDays.length > 0 && paidDays[0] < created ? paidDays[0] : created;
  const today = format(now, DAY_FORMAT);

  const rows = new Map<string, PaidRow>();
  const row = (date: string) => {
    const existing = rows.get(date);
    if (existing) return existing;
    const added: PaidRow = { date, paid: null, due: null };
    rows.set(date, added);
    return added;
  };

  let running = 0;
  if (paidDays.length === 0 || paidDays[0] > start) row(start).paid = 0;
  for (const day of paidDays) {
    running += paidByDay.get(day) ?? 0;
    row(day).paid = running;
  }
  const lastPaid = paidDays.length > 0 ? paidDays[paidDays.length - 1] : start;
  if (today > lastPaid) row(today).paid = running;

  const dueByDay = new Map<string, number>();
  for (const item of goal.items) {
    const due = itemDueDate(item, goal.targetDate);
    if (due === null) continue;
    const day = due < start ? start : due;
    dueByDay.set(day, (dueByDay.get(day) ?? 0) + effectiveAmount(item));
  }
  if (dueByDay.size > 0) {
    row(start).due = 0;
    let owed = 0;
    for (const day of [...dueByDay.keys()].sort()) {
      owed += dueByDay.get(day) ?? 0;
      row(day).due = owed;
    }
  }
  return [...rows.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
}
