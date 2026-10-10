'use client';

import { PaginationControls } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { useState } from 'react';
import { REVIEW_PAGE_SIZES } from '../constants';
import type { buildMonthlyReview } from '../lib/monthly-review';

interface MonthlyReviewSourcesProps {
  month: string;
  review: ReturnType<typeof buildMonthlyReview>;
}

export function MonthlyReviewSources({
  month,
  review,
}: MonthlyReviewSourcesProps) {
  const [page, setPage] = useState(0);
  const pageSize = REVIEW_PAGE_SIZES[0];
  const expenses = review.sources.expenses;
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(expenses.length / pageSize) - 1)
  );
  return (
    <section aria-label="Contributing records" className="space-y-4 pt-3">
      <h3 className="font-medium">Contributing records</h3>
      <div className="space-y-1">
        <h4 className="font-medium">Income · {month}</h4>
        {review.sources.income.length ? (
          review.sources.income.map((record) => (
            <p key={record.month} className="tabular-nums">
              Salary: {formatSGD(record.salaryCents / 100)} · Bonus:{' '}
              {formatSGD(record.bonusCents / 100)}
            </p>
          ))
        ) : (
          <p className="text-muted-foreground">
            No salary record for this month
          </p>
        )}
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">Expenses</h4>
        {expenses.length ? (
          <>
            <ul aria-label="Contributing expenses" className="space-y-3">
              {expenses
                .slice(visiblePage * pageSize, (visiblePage + 1) * pageSize)
                .map((record) => (
                  <li key={record.id} className="min-w-0 space-y-1 break-words">
                    <p className="font-medium [overflow-wrap:anywhere]">
                      {record.item.trim() || 'Unnamed expense'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {record.date.slice(0, 10)}
                    </p>
                    <p className="tabular-nums">
                      Gross: {formatSGD(record.grossCents / 100)} · Other
                      shares: {formatSGD(record.otherCents / 100)} · Your share:{' '}
                      {record.personalCents === null
                        ? 'Check shared splits'
                        : formatSGD(record.personalCents / 100)}
                    </p>
                  </li>
                ))}
            </ul>
            <div className="[&>div]:flex-wrap [&>div]:gap-2">
              <PaginationControls
                page={visiblePage}
                pageSize={pageSize}
                pageSizes={REVIEW_PAGE_SIZES}
                total={expenses.length}
                itemLabel="expense"
                onPageChange={setPage}
                onPageSizeChange={() => setPage(0)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              The recorded spending total includes all matching expenses, across
              every page.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            No expenses recorded for this month
          </p>
        )}
      </div>
      <div className="space-y-1">
        <h4 className="font-medium">Month-end snapshots</h4>
        <p className="tabular-nums">
          {review.previousMonth}:{' '}
          {review.sources.previousAssetTotal === null
            ? 'Not recorded'
            : formatSGD(review.sources.previousAssetTotal)}
        </p>
        <p className="tabular-nums">
          {month}:{' '}
          {review.assetTotal === null
            ? 'Not recorded'
            : formatSGD(review.assetTotal)}
        </p>
      </div>
    </section>
  );
}
