import { normalizeCategory } from './spending-stats';

export interface SpendingLine {
  category: string;
  amount: number;
  /** True when the current caller paid. */
  isSelf: boolean;
}

export interface SpendingSummary {
  total: number;
  byCategory: { category: string; total: number }[];
  youPaid: number;
  partnerPaid: number;
  /**
   * Even-split settle-up: who owes whom so each partner carries half.
   * `null` when already even.
   */
  settle: { owedBy: 'you' | 'partner'; amount: number } | null;
}

const toCents = (value: number) => Math.round(value * 100);

export function summarizeSpending(lines: SpendingLine[]): SpendingSummary {
  let youCents = 0;
  let partnerCents = 0;
  // Keyed by normalized category so case and spacing variants merge; the
  // first-seen casing is what gets displayed.
  const categories = new Map<string, { label: string; cents: number }>();
  for (const line of lines) {
    const cents = toCents(line.amount);
    if (line.isSelf) youCents += cents;
    else partnerCents += cents;
    const key = normalizeCategory(line.category);
    const entry = categories.get(key) ?? {
      label: line.category.trim(),
      cents: 0,
    };
    entry.cents += cents;
    categories.set(key, entry);
  }
  const totalCents = youCents + partnerCents;
  // Whoever paid more than half is owed the difference from the other.
  const diffCents = youCents - Math.round(totalCents / 2);
  return {
    total: totalCents / 100,
    byCategory: [...categories.values()]
      .map(({ label, cents }) => ({ category: label, total: cents / 100 }))
      .sort(
        (a, b) => b.total - a.total || a.category.localeCompare(b.category)
      ),
    youPaid: youCents / 100,
    partnerPaid: partnerCents / 100,
    settle:
      diffCents === 0
        ? null
        : {
            owedBy: diffCents > 0 ? 'partner' : 'you',
            amount: Math.abs(diffCents) / 100,
          },
  };
}

/** `date` is ISO `YYYY-MM-DD`; `month` is `YYYY-MM`. */
export function inMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month;
}
