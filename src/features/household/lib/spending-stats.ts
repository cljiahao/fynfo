import { BUDGET_SUGGESTION_MONTHS } from '../constants';
import type { SharedSpendingEntry, SpendingBudget } from '../types';

/** Category identity: case and surrounding whitespace never split a category. */
export function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

const toCents = (value: number) => Math.round(value * 100);

/** `month` is `YYYY-MM`; shifts by whole calendar months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const index = year * 12 + (mon - 1) + delta;
  const nextYear = Math.floor(index / 12);
  return `${nextYear}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export interface CategoryOption {
  label: string;
  budgeted: boolean;
}

/** Budgeted categories first, then previously used ones, de-duplicated by normalized key. */
export function categoryOptions(
  budgets: SpendingBudget[],
  entries: SharedSpendingEntry[]
): CategoryOption[] {
  const seen = new Set<string>();
  const budgeted: CategoryOption[] = [];
  const used: CategoryOption[] = [];
  const add = (list: CategoryOption[], label: string, isBudgeted: boolean) => {
    const key = normalizeCategory(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push({ label: label.trim(), budgeted: isBudgeted });
  };
  for (const budget of budgets) add(budgeted, budget.category, true);
  const newestFirst = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of newestFirst) add(used, entry.category, false);
  used.sort((a, b) => a.label.localeCompare(b.label));
  return [...budgeted, ...used];
}

/** Maps a typed category onto an existing option's casing; otherwise returns it trimmed. */
export function resolveCategory(
  options: CategoryOption[],
  input: string
): string {
  const key = normalizeCategory(input);
  return (
    options.find((option) => normalizeCategory(option.label) === key)?.label ??
    input.trim()
  );
}

export interface CategoryVsBudget {
  key: string;
  category: string;
  spent: number;
  budget: SpendingBudget | null;
  over: boolean;
  /** Spend as a share of the budget; 0 when unbudgeted. */
  ratio: number;
}

/**
 * One row per category for the month: budgeted categories first (even with no
 * spend), then unbudgeted ones by spend. `entries` are already in the month.
 */
export function monthVsBudget(
  entries: SharedSpendingEntry[],
  budgets: SpendingBudget[]
): CategoryVsBudget[] {
  const rows = new Map<
    string,
    { category: string; cents: number; budget: SpendingBudget | null }
  >();
  for (const budget of budgets) {
    const key = normalizeCategory(budget.category);
    rows.set(key, { category: budget.category, cents: 0, budget });
  }
  for (const entry of entries) {
    const key = normalizeCategory(entry.category);
    const row = rows.get(key) ?? {
      category: entry.category.trim(),
      cents: 0,
      budget: null,
    };
    row.cents += toCents(entry.amount);
    rows.set(key, row);
  }
  const result = [...rows].map(([key, row]): CategoryVsBudget => {
    const spent = row.cents / 100;
    const limit = row.budget?.monthlyAmount ?? 0;
    return {
      key,
      category: row.category,
      spent,
      budget: row.budget,
      over: row.budget !== null && spent > limit,
      ratio: row.budget ? spent / limit : 0,
    };
  });
  return result.sort(
    (a, b) =>
      Number(b.budget !== null) - Number(a.budget !== null) ||
      b.spent - a.spent ||
      a.category.localeCompare(b.category)
  );
}

/**
 * Mean spend over the last full calendar months before `currentMonth`
 * (months without entries count as zero). Null unless the category has
 * entries reaching back to the start of that window.
 */
export function suggestedBudget(
  entries: SharedSpendingEntry[],
  category: string,
  currentMonth: string
): number | null {
  const key = normalizeCategory(category);
  const windowStart = shiftMonth(currentMonth, -BUDGET_SUGGESTION_MONTHS);
  const months = entries
    .filter((entry) => normalizeCategory(entry.category) === key)
    .map((entry) => ({
      month: entry.date.slice(0, 7),
      cents: toCents(entry.amount),
    }));
  if (months.length === 0) return null;
  if (months.some((m) => m.month <= windowStart) === false) return null;
  const cents = months
    .filter((m) => m.month >= windowStart && m.month < currentMonth)
    .reduce((sum, m) => sum + m.cents, 0);
  return Math.round(cents / BUDGET_SUGGESTION_MONTHS) / 100;
}
