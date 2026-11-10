import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { monthsUntil } from './goal-stats';
import type { HouseholdRecommendation } from './household-plan';

export interface CopyOptions {
  /** Formats an amount; the caller passes a masking formatter. */
  money: (amount: number) => string;
  now: Date;
}

function monthYear(iso: string): string {
  return format(parseISO(iso.slice(0, 10)), 'MMM yyyy');
}

function dueIn(iso: string, now: Date): string {
  const months = monthsUntil(iso, now);
  if (months === null) return 'is overdue';
  if (months === 1) return 'is due within a month';
  return `is due in ${months} months`;
}

/** Wording lives here so it can change without touching the plan math. */
export function recommendationSentence(
  rec: HouseholdRecommendation,
  { money, now }: CopyOptions
): string {
  const label = rec.label ?? 'Goal';
  switch (rec.kind) {
    case 'shortfall':
      return `This month's household share exceeds what's left by ${money(rec.amounts.shortfall)}; it comes from savings.`;
    case 'next-payment':
      return `${label} ${dueIn(rec.dates.due, now)}; your share ${money(rec.amounts.amount)}.`;
    case 'behind':
      return `${label} is ${money(rec.amounts.behind)} behind; ${money(rec.amounts.catchUpPerMonth)} more a month catches up.`;
    case 'monthly-pace':
      return rec.dates.target
        ? `${label}: ${money(rec.amounts.monthly)} a month keeps you on track for ${monthYear(rec.dates.target)}.`
        : `${label}: ${money(rec.amounts.monthly)} a month keeps you on track.`;
    case 'covered':
      return `Your savings already cover ${label}.`;
    case 'missing-data':
      return rec.amounts.count === 1
        ? "1 goal has no date, so it isn't planned."
        : `${rec.amounts.count} goals have no date, so they aren't planned.`;
  }
}
