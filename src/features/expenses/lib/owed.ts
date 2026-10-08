import { format, subYears } from 'date-fns';
import type { ExpenseData } from '../types';

export interface MonthGroup {
  // "2026-03" for sorting
  monthKey: string;
  // "Mar 2026" for display
  month: string;
  total: number;
  // all expenses in this month are settled
  settled: boolean;
  expenseIds: string[];
}

export interface PersonGroup {
  person: string;
  totalOwed: number;
  months: MonthGroup[];
}

export function buildPersonGroups(
  expenses: ExpenseData[],
  now: Date = new Date()
): PersonGroup[] {
  const cutoffKey = format(subYears(now, 1), 'yyyy-MM');

  // person → monthKey → { total, settled, expenseIds }
  const map = new Map<
    string,
    Map<
      string,
      {
        month: string;
        total: number;
        unpaid: number;
        allSettled: boolean;
        expenseIds: string[];
      }
    >
  >();

  for (const e of expenses) {
    if (e.splitType !== 'shared') continue;
    for (const s of e.splits) {
      if (!map.has(s.person)) map.set(s.person, new Map());
      const monthMap = map.get(s.person)!;
      const monthKey = format(new Date(e.date), 'yyyy-MM');
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: format(new Date(e.date), 'MMM yyyy'),
          total: 0,
          unpaid: 0,
          allSettled: true,
          expenseIds: [],
        });
      }
      const entry = monthMap.get(monthKey)!;
      entry.total += s.amount;
      if (!s.settled) {
        entry.unpaid += s.amount;
        entry.allSettled = false;
      }
      if (!entry.expenseIds.includes(e.id)) entry.expenseIds.push(e.id);
    }
  }

  const groups: PersonGroup[] = [];
  for (const [person, monthMap] of map.entries()) {
    const months: MonthGroup[] = Array.from(monthMap.entries())
      .map(([monthKey, entry]) => ({
        monthKey,
        month: entry.month,
        total: entry.total,
        settled: entry.allSettled,
        expenseIds: entry.expenseIds,
      }))
      // Unsettled: always show. Settled: only within the past year.
      .filter((m) => !m.settled || m.monthKey >= cutoffKey)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    if (months.length === 0) continue;

    const totalOwed = Array.from(monthMap.values()).reduce(
      (sum, entry) => sum + entry.unpaid,
      0
    );

    groups.push({ person, totalOwed, months });
  }

  // Sort: people with outstanding balance first, then by name
  return groups.sort((a, b) => {
    if (b.totalOwed !== a.totalOwed) return b.totalOwed - a.totalOwed;
    return a.person.localeCompare(b.person);
  });
}
