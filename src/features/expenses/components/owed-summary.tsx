'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSGD } from '@/lib/utils/currency';
import { Check, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useSettleMonthSplits } from '../hooks/use-expenses';
import { buildPersonGroups } from '../lib/owed';
import type { ExpenseData } from '../types';

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
            <span className="text-gain text-lg font-bold">
              {formatSGD(totalUnsettled)}
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
                    <span className="text-gain text-sm font-semibold">
                      {formatSGD(group.totalOwed)}
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
                        className={`size-6 shrink-0 ${m.settled ? 'bg-gain hover:bg-gain/90' : ''}`}
                        onClick={() =>
                          handleSettle(m.expenseIds, group.person, !m.settled)
                        }
                        disabled={settle.isPending}
                        aria-label={
                          m.settled
                            ? 'Mark month unsettled'
                            : 'Mark month settled'
                        }
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
                        {formatSGD(m.total)}
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
