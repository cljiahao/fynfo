import type { IncomeLine, SalaryData } from '../types';

export interface MonthSummary {
  recurring: number;
  bonus: number;
  oneTime: number;
  total: number;
}

export function normalizeEmployer(label: string): string {
  return label.trim().toLowerCase();
}

export function summarizeMonth(lines: readonly IncomeLine[]): MonthSummary {
  let recurring = 0;
  let bonus = 0;
  let oneTime = 0;
  for (const line of lines) {
    if (line.type === 'salary') recurring += line.amount;
    else if (line.type === 'bonus') bonus += line.amount;
    else oneTime += line.amount;
  }
  return { recurring, bonus, oneTime, total: recurring + bonus + oneTime };
}

/** Recurring amount per employer, keyed by the normalized salary-line label. */
export function recurringByEmployer(
  lines: readonly IncomeLine[]
): Map<string, number> {
  const byEmployer = new Map<string, number>();
  for (const line of lines) {
    if (line.type !== 'salary') continue;
    const key = normalizeEmployer(line.label);
    byEmployer.set(key, (byEmployer.get(key) ?? 0) + line.amount);
  }
  return byEmployer;
}

function monthIndex(id: string): number {
  const [year, month] = id.split('-').map(Number);
  return year * 12 + (month - 1);
}

/** Bonus and one-time totals over the 12 calendar months ending at `upToId`. */
export function trailingTwelveMonths(
  months: readonly { id: string; lines: readonly IncomeLine[] }[],
  upToId: string
): { bonus: number; oneTime: number } {
  const end = monthIndex(upToId);
  let bonus = 0;
  let oneTime = 0;
  for (const month of months) {
    const index = monthIndex(month.id);
    if (index > end || index <= end - 12) continue;
    const summary = summarizeMonth(month.lines);
    bonus += summary.bonus;
    oneTime += summary.oneTime;
  }
  return { bonus, oneTime };
}

/** Builds the consumer-facing month, keeping legacy `salary`/`bonus` populated. */
export function toSalaryData(id: string, lines: IncomeLine[]): SalaryData {
  const summary = summarizeMonth(lines);
  return {
    id,
    lines,
    salary: summary.recurring,
    bonus: summary.bonus,
    recurring: summary.recurring,
    oneTime: summary.oneTime,
    total: summary.total,
  };
}

interface LegacyRow {
  month: string;
  salary: number;
  bonus: number;
}

/**
 * Lines win over the legacy row for a month; a month with only a legacy row
 * is synthesized as one "Salary" line plus a "Bonus" line when bonus > 0.
 */
export function mergeSalaryMonths(
  lineRows: readonly (IncomeLine & { month: string })[],
  legacyRows: readonly LegacyRow[]
): SalaryData[] {
  const byMonth = new Map<string, IncomeLine[]>();
  for (const { month, ...line } of lineRows) {
    const lines = byMonth.get(month) ?? [];
    lines.push(line);
    byMonth.set(month, lines);
  }
  for (const legacy of legacyRows) {
    if (byMonth.has(legacy.month)) continue;
    const lines: IncomeLine[] = [];
    if (legacy.salary > 0 || legacy.bonus <= 0) {
      lines.push({
        id: `legacy-salary-${legacy.month}`,
        type: 'salary',
        label: 'Salary',
        amount: legacy.salary,
      });
    }
    if (legacy.bonus > 0) {
      lines.push({
        id: `legacy-bonus-${legacy.month}`,
        type: 'bonus',
        label: 'Bonus',
        amount: legacy.bonus,
      });
    }
    byMonth.set(legacy.month, lines);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, lines]) => toSalaryData(id, lines));
}
