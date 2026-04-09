'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, subYears } from 'date-fns';
import { Check, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useSettleMonthSplits } from '../hooks/use-expenses';
import type { ExpenseData } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value);

interface MonthGroup {
  monthKey: string; // "2026-03" for sorting
  month: string; // "Mar 2026" for display
  total: number;
  settled: boolean; // all expenses in this month are settled
  expenseIds: string[];
}

interface PersonGroup {
  person: string;
  totalOwed: number;
  months: MonthGroup[];
}

function buildPersonGroups(expenses: ExpenseData[]): PersonGroup[] {
  const cutoffKey = format(subYears(new Date(), 1), 'yyyy-MM');

  // person → monthKey → { total, settled, expenseIds }
  const map = new Map<
    string,
    Map<
      string,
      {
        month: string;
        total: number;
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
      const monthKey = e.date.slice(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: format(new Date(e.date), 'MMM yyyy'),
          total: 0,
          allSettled: true,
          expenseIds: [],
        });
      }
      const entry = monthMap.get(monthKey)!;
      entry.total += s.amount;
      if (!s.settled) entry.allSettled = false;
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

    const totalOwed = months
      .filter((m) => !m.settled)
      .reduce((sum, m) => sum + m.total, 0);

    groups.push({ person, totalOwed, months });
  }

  // Sort: people with outstanding balance first, then by name
  return groups.sort((a, b) => {
    if (b.totalOwed !== a.totalOwed) return b.totalOwed - a.totalOwed;
    return a.person.localeCompare(b.person);
  });
}

interface OwedSummaryProps {
  expenses: ExpenseData[];
}

export function OwedSummary({ expenses }: OwedSummaryProps) {
  const settle = useSettleMonthSplits();

  const groups = buildPersonGroups(expenses);
  const totalUnsettled = groups.reduce((sum, g) => sum + g.totalOwed, 0);

  const handleSettle = async (
    expenseIds: string[],
    person: string,
    settled: boolean
  ) => {
    try {
      await settle.mutateAsync({ expenseIds, person, settled });
      toast.success(settled ? 'Marked as settled' : 'Marked as unsettled');
    } catch {
      toast.error('Failed to update');
    }
  };

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleDollarSign className="size-4" />
            Who Owes You
          </CardTitle>
          {totalUnsettled > 0 && (
            <span className="text-lg font-bold text-emerald-600">
              {formatCurrency(totalUnsettled)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {groups.map((group) => (
            <AccordionItem
              key={group.person}
              value={group.person}
              className="border-b last:border-0"
            >
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex-between w-full pr-2">
                  <span className="text-sm font-medium">{group.person}</span>
                  {group.totalOwed > 0 ? (
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(group.totalOwed)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      All settled
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1">
                  {group.months.map((m) => (
                    <div
                      key={m.monthKey}
                      className="flex items-center gap-2 rounded-md px-1 py-1 text-xs"
                    >
                      <Button
                        variant={m.settled ? 'default' : 'outline'}
                        size="icon"
                        className={`size-6 shrink-0 ${m.settled ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        onClick={() =>
                          handleSettle(m.expenseIds, group.person, !m.settled)
                        }
                        disabled={settle.isPending}
                      >
                        <Check className="size-3" />
                      </Button>
                      <span
                        className={`flex-1 ${m.settled ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {m.month}
                      </span>
                      <span
                        className={`w-20 shrink-0 text-right font-medium tabular-nums ${m.settled ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
