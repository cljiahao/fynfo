import { formatSGD } from '@/lib/utils/currency';
import { addMonths } from 'date-fns/addMonths';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { differenceInMonths } from 'date-fns/differenceInMonths';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { ITEM_CHART_CAP, NO_ITEMS_SUMMARY } from '../constants';
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

export interface ItemChartRow {
  id: string;
  name: string;
  budget: number;
  paid: number;
  over: number;
}

export interface ItemChartData {
  rows: ItemChartRow[];
  /** Items left out of `rows` by the cap. */
  more: number;
}

/** The largest budgets first, capped so the chart stays readable on a phone. */
export function itemChartRows(
  goal: Pick<HouseholdGoal, 'items'>,
  cap: number = ITEM_CHART_CAP
): ItemChartData {
  const sorted = [...goal.items].sort((a, b) => b.budget - a.budget);
  return {
    rows: sorted.slice(0, cap).map((item) => ({
      id: item.id,
      name: item.name,
      budget: item.budget,
      paid: item.paid,
      over: item.over,
    })),
    more: Math.max(0, sorted.length - cap),
  };
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
