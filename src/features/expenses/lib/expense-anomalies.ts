import { YYYY_MM } from '@/lib/zod-utils';
import {
  EXPENSE_ANOMALY_BASELINE_MONTHS,
  EXPENSE_ANOMALY_MINIMUM_EXCESS_CENTS,
  EXPENSE_ANOMALY_MULTIPLIER,
  EXPENSE_TYPES,
} from '../constants';
import { expenseDataSchema } from '../schemas';
import type { ExpenseData, ExpenseType } from '../types';
import { getSplitAllocationError } from './split-amounts';

export interface ExpenseAnomalySourceRecord {
  readonly id: string;
  readonly date: string;
  readonly item: string;
  readonly grossCents: number;
  readonly otherCents: number;
  readonly personalCents: number;
}

export interface ExpenseAnomalyMonthTotal {
  readonly month: string;
  readonly totalCents: number;
  readonly recordCount: number;
}

export type ExpenseAnomalyCategoryUnavailableReason =
  | 'missing-history'
  | 'invalid-record'
  | 'unsafe-total'
  | 'zero-baseline';

export type ExpenseAnomalyCategoryReview =
  | {
      readonly status: 'unavailable';
      readonly category: ExpenseType;
      readonly reason: ExpenseAnomalyCategoryUnavailableReason;
      readonly missingMonths: readonly string[];
    }
  | {
      readonly status: 'comparable';
      readonly category: ExpenseType;
      readonly selectedTotalCents: number;
      readonly baselineMedianCents: number;
      readonly excessCents: number;
      readonly baselineTotals: readonly ExpenseAnomalyMonthTotal[];
      readonly selectedRecordCount: number;
    };

export interface ExpenseAnomalySuggestion {
  readonly category: ExpenseType;
  readonly selectedTotalCents: number;
  readonly baselineMedianCents: number;
  readonly excessCents: number;
  readonly baselineTotals: readonly ExpenseAnomalyMonthTotal[];
  readonly sources: readonly ExpenseAnomalySourceRecord[];
}

export type ExpenseAnomalyReview =
  | {
      readonly status: 'unavailable';
      readonly selectedMonth: string;
      readonly reason:
        | 'invalid-month'
        | 'month-not-elapsed'
        | 'invalid-date'
        | 'invalid-metadata'
        | 'duplicate-id';
    }
  | {
      readonly status: 'ready';
      readonly selectedMonth: string;
      readonly baselineMonths: readonly string[];
      readonly categories: readonly ExpenseAnomalyCategoryReview[];
      readonly suggestions: readonly ExpenseAnomalySuggestion[];
    };

type MutableMonthTotal = {
  -readonly [Property in keyof ExpenseAnomalyMonthTotal]: ExpenseAnomalyMonthTotal[Property];
};

interface CategoryWindow {
  category: ExpenseType;
  months: MutableMonthTotal[];
  sources: ExpenseAnomalySourceRecord[];
  issue: 'invalid-record' | 'unsafe-total' | null;
}

function monthIndex(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return year * 12 + monthNumber - 1;
}

function monthKey(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function sourceRecord(record: ExpenseData): ExpenseAnomalySourceRecord | null {
  if (
    typeof record.amount !== 'number' ||
    !Number.isFinite(record.amount) ||
    record.amount <= 0 ||
    !Number.isSafeInteger(Math.round(record.amount * 100)) ||
    typeof record.item !== 'string'
  )
    return null;

  const grossCents = Math.round(record.amount * 100);
  let otherCents = 0;
  if (record.splitType === 'shared') {
    if (
      !Array.isArray(record.splits) ||
      record.splits.some(
        (split) => !split || typeof split.amount !== 'number'
      ) ||
      getSplitAllocationError(record.amount, record.splits) !== null
    )
      return null;
    otherCents = record.splits.reduce(
      (sum, split) => sum + Math.round(split.amount * 100),
      0
    );
  }
  return {
    id: record.id,
    date: record.date.slice(0, 10),
    item: record.item,
    grossCents,
    otherCents,
    personalCents: grossCents - otherCents,
  };
}

function compareSourceRecords(
  left: ExpenseAnomalySourceRecord,
  right: ExpenseAnomalySourceRecord
): number {
  // Code-unit ordering is stable across browser locales.
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

/** Compare recorded personal shares only; never impute missing months as zero. */
export function buildExpenseAnomalyReview(
  expenses: readonly ExpenseData[],
  selectedMonth: string,
  currentSingaporeMonth: string
): ExpenseAnomalyReview {
  if (
    !YYYY_MM.safeParse(selectedMonth).success ||
    !YYYY_MM.safeParse(currentSingaporeMonth).success
  )
    return { status: 'unavailable', selectedMonth, reason: 'invalid-month' };
  const selectedIndex = monthIndex(selectedMonth);
  if (selectedIndex < EXPENSE_ANOMALY_BASELINE_MONTHS)
    return { status: 'unavailable', selectedMonth, reason: 'invalid-month' };
  if (selectedIndex >= monthIndex(currentSingaporeMonth))
    return {
      status: 'unavailable',
      selectedMonth,
      reason: 'month-not-elapsed',
    };

  const baselineMonths = Array.from(
    { length: EXPENSE_ANOMALY_BASELINE_MONTHS },
    function baselineMonth(_, index) {
      return monthKey(selectedIndex - EXPENSE_ANOMALY_BASELINE_MONTHS + index);
    }
  );
  const windowMonths = [...baselineMonths, selectedMonth];
  const categories = EXPENSE_TYPES.map(
    function categoryWindow(category): CategoryWindow {
      return {
        category,
        months: windowMonths.map(function emptyMonth(month) {
          return { month, totalCents: 0, recordCount: 0 };
        }),
        sources: [],
        issue: null,
      };
    }
  );
  const categoryWindows = new Map(
    categories.map(function categoryEntry(window) {
      return [window.category, window] as const;
    })
  );
  // Validate in fixed priority order so malformed history is order-independent.
  if (
    expenses.some(function invalidDate(record) {
      return !expenseDataSchema.shape.date.safeParse(record.date).success;
    })
  )
    return { status: 'unavailable', selectedMonth, reason: 'invalid-date' };
  const relevantRecords = expenses.filter(function insideWindow(record) {
    return windowMonths.includes(record.date.slice(0, 7));
  });
  if (
    relevantRecords.some(function invalidMetadata(record) {
      return (
        !EXPENSE_TYPES.includes(record.type) ||
        (record.splitType !== 'self' && record.splitType !== 'shared') ||
        typeof record.id !== 'string' ||
        record.id.length === 0
      );
    })
  )
    return { status: 'unavailable', selectedMonth, reason: 'invalid-metadata' };
  const seenIds = new Set<string>();
  for (const record of relevantRecords) {
    if (seenIds.has(record.id))
      return { status: 'unavailable', selectedMonth, reason: 'duplicate-id' };
    seenIds.add(record.id);
  }
  for (const record of relevantRecords) {
    const recordMonth = record.date.slice(0, 7);
    const window = categoryWindows.get(record.type)!;
    const source = sourceRecord(record);
    if (!source) {
      window.issue = 'invalid-record';
      continue;
    }
    const month = window.months.find(function matchingMonth(total) {
      return total.month === recordMonth;
    })!;
    const totalCents = month.totalCents + source.personalCents;
    if (!Number.isSafeInteger(totalCents)) {
      window.issue = window.issue ?? 'unsafe-total';
      continue;
    }
    month.totalCents = totalCents;
    month.recordCount += 1;
    if (recordMonth === selectedMonth) window.sources.push(source);
  }

  const reviews: ExpenseAnomalyCategoryReview[] = [];
  const suggestions: ExpenseAnomalySuggestion[] = [];
  for (const window of categories) {
    const missingMonths = window.months
      .filter(function unrecordedMonth(month) {
        return month.recordCount === 0;
      })
      .map(function missingMonthKey(month) {
        return month.month;
      });
    if (window.issue || missingMonths.length > 0) {
      reviews.push({
        status: 'unavailable',
        category: window.category,
        reason: window.issue ?? 'missing-history',
        missingMonths,
      });
      continue;
    }
    const baselineTotals = window.months.slice(
      0,
      EXPENSE_ANOMALY_BASELINE_MONTHS
    );
    const median = baselineTotals
      .map(function baselineTotal(month) {
        return month.totalCents;
      })
      .sort(function ascendingCents(left, right) {
        return left - right;
      })[1];
    if (median === 0) {
      reviews.push({
        status: 'unavailable',
        category: window.category,
        reason: 'zero-baseline',
        missingMonths: [],
      });
      continue;
    }
    const selectedTotalCents =
      window.months[EXPENSE_ANOMALY_BASELINE_MONTHS].totalCents;
    const excessCents = selectedTotalCents - median;
    reviews.push({
      status: 'comparable',
      category: window.category,
      selectedTotalCents,
      baselineMedianCents: median,
      excessCents,
      baselineTotals,
      selectedRecordCount: window.sources.length,
    });
    // Division avoids overflowing 2 × median for otherwise safe cent totals.
    if (
      median <= Math.floor(selectedTotalCents / EXPENSE_ANOMALY_MULTIPLIER) &&
      excessCents >= EXPENSE_ANOMALY_MINIMUM_EXCESS_CENTS
    ) {
      suggestions.push({
        category: window.category,
        selectedTotalCents,
        baselineMedianCents: median,
        excessCents,
        baselineTotals,
        sources: [...window.sources].sort(compareSourceRecords),
      });
    }
  }
  suggestions.sort(function largestExcessFirst(left, right) {
    return (
      right.excessCents - left.excessCents ||
      EXPENSE_TYPES.indexOf(left.category) -
        EXPENSE_TYPES.indexOf(right.category)
    );
  });
  return {
    status: 'ready',
    selectedMonth,
    baselineMonths,
    categories: reviews,
    suggestions,
  };
}
