import { formatSGDWhole } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import {
  FREEDOM_BOUNDS,
  type FreedomAssumptions,
} from '../hooks/use-freedom-inputs';
import type {
  FreedomLever,
  FreedomProjection,
} from '../lib/freedom-projection';

export const CAP_YEARS = 60;

export function formatMonthLabel(label: string): string {
  return format(parseISO(`${label}-01`), 'MMM yyyy');
}

function yearOf(label: string): string {
  return label.slice(0, 4);
}

export function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** One-sentence state of the projection for the collapsed card. */
export function freedomSummary(projection: FreedomProjection): string {
  switch (projection.status) {
    case 'no_assumptions':
      return 'Add your return and withdrawal assumptions to see a projection';
    case 'no_expenses':
      return 'Add expenses to set a freedom number.';
    case 'invalid':
      return 'Projection unavailable with the current figures.';
    default:
      break;
  }
  const lead =
    projection.status === 'no_portfolio'
      ? 'No invested portfolio yet. '
      : projection.progressPct === null
        ? ''
        : `${Math.round(projection.progressPct)}% of the way. `;
  if (projection.base.reached) {
    return 'Your portfolio already covers your living costs at your assumptions.';
  }
  const { high, low } = projection;
  if (high.date === null) {
    return `${lead}Not reached within ${CAP_YEARS} years at this pace.`;
  }
  if (low.date === null) {
    return `${lead}From ${yearOf(high.date)}; the low case is not reached within ${CAP_YEARS} years.`;
  }
  const earliest = yearOf(high.date);
  const latest = yearOf(low.date);
  return earliest === latest
    ? `${lead}On track for around ${earliest}.`
    : `${lead}On track for ${earliest} to ${latest}.`;
}

export function formatLever(
  lever: FreedomLever,
  mask: (text: string) => string
): string {
  switch (lever.kind) {
    case 'extra-monthly':
      return `Investing ${mask(formatSGDWhole(lever.amount))} more a month brings your date forward ${plural(lever.monthsEarlier, 'month')}.`;
    case 'expense-drift':
      return `Spending is ${Math.round(lever.driftPct)}% above your 12-month average. If it stays there, your date moves back ${plural(lever.monthsLater, 'month')}.`;
    case 'emergency-surplus':
      return `Your emergency fund is ${mask(formatSGDWhole(lever.amount))} above target, available to invest if you choose.`;
    case 'household-goal-ends':
      return `Household goal ${lever.name} ends in ${formatMonthLabel(lever.endMonth)}; your investing rises by ${mask(formatSGDWhole(lever.extraInvesting))} a month after.`;
  }
}

/** Months of the projection that fall in each calendar year. */
export function monthsByYear(now: Date, total: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (let step = 1; step <= total; step += 1) {
    const index = now.getMonth() + step;
    const year = now.getFullYear() + Math.floor(index / 12);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return counts;
}

export interface AssumptionDraft {
  realReturn: string;
  withdrawalRate: string;
  targetYear: string;
}

export interface AssumptionValidation {
  value: FreedomAssumptions | null;
  errors: Partial<Record<keyof AssumptionDraft, string>>;
}

function parseField(
  raw: string,
  min: number,
  max: number,
  label: string,
  integer = false
): { value: number | null; error?: string } {
  const text = raw.trim();
  if (text === '') return { value: null };
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    return { value: null, error: `${label} must be a number.` };
  }
  if (parsed < min || parsed > max) {
    return {
      value: null,
      error: `${label} must be between ${min} and ${max}.`,
    };
  }
  return { value: parsed };
}

/** A blank field is valid and means "unset". */
export function validateAssumptions(
  draft: AssumptionDraft,
  currentYear: number
): AssumptionValidation {
  const ret = parseField(
    draft.realReturn,
    FREEDOM_BOUNDS.realReturnPct.min,
    FREEDOM_BOUNDS.realReturnPct.max,
    'Real return'
  );
  const wr = parseField(
    draft.withdrawalRate,
    FREEDOM_BOUNDS.withdrawalRatePct.min,
    FREEDOM_BOUNDS.withdrawalRatePct.max,
    'Withdrawal rate'
  );
  const ty = parseField(
    draft.targetYear,
    currentYear,
    currentYear + FREEDOM_BOUNDS.targetYearSpan,
    'Target year',
    true
  );
  const errors: AssumptionValidation['errors'] = {};
  if (ret.error) errors.realReturn = ret.error;
  if (wr.error) errors.withdrawalRate = wr.error;
  if (ty.error) errors.targetYear = ty.error;
  if (Object.keys(errors).length > 0) return { value: null, errors };
  return {
    value: {
      realReturnPct: ret.value,
      withdrawalRatePct: wr.value,
      targetYear: ty.value,
    },
    errors,
  };
}
