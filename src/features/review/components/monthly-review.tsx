'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSnapshots } from '@/features/assets';
import { useExpenses } from '@/features/expenses';
import { useSalaryRecords } from '@/features/salary';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGD } from '@/lib/utils/currency';
import { YYYY_MM } from '@/lib/zod-utils';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { buildMonthlyReview } from '../lib/monthly-review';

export function MonthlyReview() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const snapshots = useSnapshots();
  const salary = useSalaryRecords();
  const expenses = useExpenses();
  const queries = [snapshots, salary, expenses];
  const pending = queries.some((query) => query.isPending);
  const failed = queries.some((query) => query.isError);
  const validMonth = YYYY_MM.safeParse(month).success;
  const review =
    !pending && !failed && validMonth
      ? buildMonthlyReview(
          month,
          snapshots.data ?? [],
          salary.data ?? [],
          expenses.data ?? []
        )
      : null;

  return (
    <section
      aria-labelledby="monthly-review-title"
      className="border-border space-y-4 rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="monthly-review-title" className="text-lg font-semibold">
          Monthly review
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="review-month">Month</Label>
          <Input
            id="review-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-auto"
          />
        </div>
      </div>
      {!validMonth && <p role="alert">Choose a valid month to review.</p>}
      {pending && (
        <p role="status" className="text-muted-foreground text-sm">
          Loading your monthly records…
        </p>
      )}
      {failed && (
        <div role="alert" className="space-y-2 text-sm">
          <p>Couldn&apos;t load your monthly review.</p>
          <Button
            variant="outline"
            onClick={() => {
              for (const query of queries)
                if (query.isError) void query.refetch();
            }}
          >
            Retry monthly review
          </Button>
        </div>
      )}
      {review && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-sm">
                Recorded gross income
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {review.incomeRecorded
                  ? formatSGD(review.grossIncome)
                  : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                Recorded spending · your share
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {review.personalSpending === null
                  ? 'Check shared splits'
                  : review.expenseCount
                    ? formatSGD(review.personalSpending)
                    : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">
                Asset change from {review.previousMonth}
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {review.assetChange === null
                  ? 'Needs both snapshots'
                  : formatSGD(review.assetChange)}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground text-xs">
            Recorded income is before CPF and tax. Missing records do not mean
            zero income or spending.
          </p>
          <Accordion type="single" collapsible>
            <AccordionItem value="sources">
              <AccordionTrigger>Sources and next steps</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm">
                <p>
                  Spending includes all recorded categories and excludes other
                  people&apos;s shares, whether settled or not. Asset changes
                  include contributions, withdrawals and valuation changes; they
                  are not investment returns.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    className="underline underline-offset-4"
                    href={PAGE_ROUTES.SALARY}
                  >
                    Review salary
                  </Link>
                  <Link
                    className="underline underline-offset-4"
                    href={PAGE_ROUTES.EXPENSES}
                  >
                    Review expenses
                  </Link>
                  <Link
                    className="underline underline-offset-4"
                    href={PAGE_ROUTES.ASSETS}
                  >
                    Review snapshots
                  </Link>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </section>
  );
}
