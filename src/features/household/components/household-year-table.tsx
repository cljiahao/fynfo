'use client';

import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ScheduleEntry } from '../lib/household-plan';

interface Props {
  schedule: ScheduleEntry[];
  goals: { id: string; name: string }[];
}

interface YearRow {
  year: string;
  total: number;
  byGoal: { goalId: string; total: number }[];
}

function groupByYear(schedule: ScheduleEntry[]): YearRow[] {
  const years = new Map<string, Map<string, number>>();
  for (const entry of schedule) {
    const year = entry.date.slice(0, 4);
    const goals = years.get(year) ?? new Map<string, number>();
    goals.set(entry.goalId, (goals.get(entry.goalId) ?? 0) + entry.amount);
    years.set(year, goals);
  }
  return [...years.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([year, goals]) => ({
      year,
      total: [...goals.values()].reduce((sum, n) => sum + n, 0),
      byGoal: [...goals.entries()].map(([goalId, total]) => ({
        goalId,
        total,
      })),
    }));
}

/** Your share due per calendar year; display only, never feeds the plan. */
export function HouseholdYearTable({ schedule, goals }: Props) {
  const { mask } = useAmountVisibility();
  const [open, setOpen] = useState<string | null>(null);
  const rows = groupByYear(schedule);
  if (rows.length === 0) return null;

  const names = new Map(goals.map((goal) => [goal.id, goal.name]));
  const money = (amount: number) => mask(formatSGDWhole(amount));

  return (
    <div className="divide-y rounded-xl border text-sm">
      {rows.map((row) => {
        const expanded = open === row.year;
        return (
          <div key={row.year}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : row.year)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <ChevronDown
                  aria-hidden
                  className={
                    expanded
                      ? 'size-4 transition-transform'
                      : 'size-4 -rotate-90 transition-transform'
                  }
                />
                {row.year}
              </span>
              <span className="tabular-nums">{money(row.total)}</span>
            </button>
            {expanded && (
              <ul className="text-muted-foreground space-y-1 px-3 pb-3 pl-9">
                {row.byGoal.map((line) => (
                  <li
                    key={line.goalId}
                    className="flex justify-between gap-2 tabular-nums"
                  >
                    <span className="truncate">
                      {names.get(line.goalId) ?? 'Goal'}
                    </span>
                    <span>{money(line.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
