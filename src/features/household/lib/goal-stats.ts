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
  const today = startOfDay(now);
  const target = parseISO(goal.targetDate.slice(0, 10));
  if (target < today) return 'past';
  const whole = differenceInMonths(target, today);
  const months = addMonths(today, whole) < target ? whole + 1 : whole;
  return goal.remaining / Math.max(1, months);
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

const toCents = (amount: number) => Math.round(amount * 100);

/**
 * Funded, undated, or on track against a straight line from creation to the
 * target date. Compared in whole cents so float noise never flips the chip.
 */
export function goalStatus(
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

const DAY_FORMAT = 'yyyy-MM-dd';

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
