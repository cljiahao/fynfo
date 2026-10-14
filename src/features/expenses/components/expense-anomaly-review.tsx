'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginationControls } from '@/components/widgets';
import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';
import { useIsMutating } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import {
  EXPENSE_ANOMALY_CATEGORY_MESSAGES,
  EXPENSE_ANOMALY_REVIEW_MESSAGES,
  EXPENSE_ANOMALY_SOURCE_PAGE_SIZES,
  EXPENSE_TYPE_LABELS,
} from '../constants';
import { useExpenses } from '../hooks/use-expenses';
import {
  buildExpenseAnomalyReview,
  type ExpenseAnomalyReview as ExpenseAnomalyResult,
  type ExpenseAnomalySuggestion,
} from '../lib/expense-anomalies';
import type { ExpenseData } from '../types';

function formatCents(cents: number): string {
  const value = BigInt(cents);
  const whole = Number(value / BigInt(100)).toLocaleString('en-SG');
  return `SGD ${whole}.${String(value % BigInt(100)).padStart(2, '0')}`;
}

function singaporeMonth(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')!.value.padStart(4, '0')}-${parts.find((part) => part.type === 'month')!.value}`;
}
function precedingMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return number === 1
    ? `${String(year - 1).padStart(4, '0')}-12`
    : `${String(year).padStart(4, '0')}-${String(number - 1).padStart(2, '0')}`;
}
interface ReviewSnapshot {
  readonly id: number;
  readonly rows: ExpenseData[];
  readonly month: string;
  readonly hideEpoch: number;
  readonly result: ExpenseAnomalyResult;
}
function SourceReview({
  suggestion,
}: {
  suggestion: ExpenseAnomalySuggestion;
}) {
  const [page, setPage] = useState(0);
  const pageSize = EXPENSE_ANOMALY_SOURCE_PAGE_SIZES[0];
  const rows = suggestion.sources.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <details className="space-y-3">
      <summary className="cursor-pointer text-sm underline underline-offset-4">
        Review contributing records
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Item / brand</th>
              <th className="py-2 text-right">Gross</th>
              <th className="py-2 text-right">Other shares</th>
              <th className="py-2 text-right">Personal share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2 pr-3 whitespace-nowrap">{row.date}</td>
                <td className="max-w-xs py-2 pr-3 [overflow-wrap:anywhere]">
                  {row.item || 'No item recorded'}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatCents(row.grossCents)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatCents(row.otherCents)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatCents(row.personalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        pageSizes={EXPENSE_ANOMALY_SOURCE_PAGE_SIZES}
        total={suggestion.sources.length}
        itemLabel="source record"
        onPageChange={setPage}
        onPageSizeChange={() => setPage(0)}
      />
    </details>
  );
}
function ReviewResults({ result }: { result: ExpenseAnomalyResult }) {
  if (result.status === 'unavailable')
    return <p role="alert">{EXPENSE_ANOMALY_REVIEW_MESSAGES[result.reason]}</p>;
  const unavailable = result.categories.filter(
    (category) => category.status === 'unavailable'
  );
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Review month: {result.selectedMonth}. Baseline months:{' '}
        {result.baselineMonths.join(', ')}. Grouped by recorded expense date.
      </p>
      {result.suggestions.length === 0 && (
        <p role="status">
          No category meets this review rule.{' '}
          {result.categories.length - unavailable.length} categories comparable;{' '}
          {unavailable.length} unavailable.
        </p>
      )}
      <ul className="space-y-5">
        {result.suggestions.map((suggestion) => (
          <li key={suggestion.category} className="space-y-3 border-t pt-4">
            <h3 className="font-medium">
              {EXPENSE_TYPE_LABELS[suggestion.category]} recorded higher than
              recent months
            </h3>
            <p className="text-sm">
              {formatCents(suggestion.selectedTotalCents)} this month; the
              median of the previous three recorded months was{' '}
              {formatCents(suggestion.baselineMedianCents)}. Recorded excess:{' '}
              {formatCents(suggestion.excessCents)}.
            </p>
            <details>
              <summary className="cursor-pointer text-sm underline underline-offset-4">
                How this comparison was made
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {suggestion.baselineTotals.map((month) => (
                  <li key={month.month}>
                    {month.month}: {formatCents(month.totalCents)} from{' '}
                    {month.recordCount} recorded expense(s)
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-2 text-sm">
                At least twice the three-month median and at least SGD 50
                higher. Missing category months are not treated as zero. Shared
                spending subtracts all other-person shares, regardless of
                settlement.
              </p>
            </details>
            <SourceReview suggestion={suggestion} />
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm underline underline-offset-4">
          Comparison availability ({result.categories.length} categories)
        </summary>
        <ul className="mt-2 space-y-2 text-sm">
          {result.categories.map((category) => (
            <li key={category.category}>
              <span className="font-medium">
                {EXPENSE_TYPE_LABELS[category.category]}:{' '}
              </span>
              {category.status === 'comparable' ? (
                'Comparable recorded history.'
              ) : (
                <>
                  {EXPENSE_ANOMALY_CATEGORY_MESSAGES[category.reason]}
                  {category.missingMonths.length > 0 &&
                    ` Missing months: ${category.missingMonths.join(', ')}.`}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
/** Explicit read-only review of the complete loaded history, never table pages. */
export function ExpenseAnomalyReview() {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const revision = useRef(0);
  const query = useExpenses();
  const mutationCount = useIsMutating();
  const { hidden, canReveal, getHideEpoch } = useAmountVisibility();
  const [clock, setClock] = useState(singaporeMonth);
  const [month, setMonth] = useState(() => precedingMonth(clock));
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const ready =
    query.isSuccess &&
    !query.isError &&
    !query.isFetching &&
    mutationCount === 0 &&
    query.data !== undefined;
  const readiness = `${query.isSuccess}/${query.isError}/${query.isFetching}/${mutationCount}`;
  const hideEpoch = getHideEpoch();
  const [observed, setObserved] = useState({
    rows: query.data,
    month,
    readiness,
    hideEpoch,
  });
  if (
    observed.rows !== query.data ||
    observed.month !== month ||
    observed.readiness !== readiness ||
    observed.hideEpoch !== hideEpoch
  ) {
    setObserved({ rows: query.data, month, readiness, hideEpoch });
    if (snapshot !== null) setSnapshot(null);
  }
  const current =
    !hidden &&
    ready &&
    snapshot !== null &&
    snapshot.rows === query.data &&
    snapshot.month === month &&
    snapshot.hideEpoch === hideEpoch;
  function review() {
    if (!canReveal() || !ready || !query.data) return;
    const now = singaporeMonth();
    setClock(now);
    setSnapshot({
      id: ++revision.current,
      rows: query.data,
      month,
      hideEpoch: getHideEpoch(),
      result: buildExpenseAnomalyReview(query.data, month, now),
    });
  }
  return (
    <Dialog
      open={open && !hidden}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) review();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={hidden}>
          Compare months
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>What changed this month?</DialogTitle>
          <DialogDescription>
            Find categories with larger recorded spending than the previous
            three months.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <details className="text-muted-foreground text-sm">
            <summary className="cursor-pointer">How comparison works</summary>
            <p className="mt-2">
              Recorded data may be incomplete. Review rule: at least twice the
              preceding three-month median and at least SGD 50 higher. Singapore
              month: {clock}. Compare completed months only.
            </p>
          </details>
          <AmountsHiddenNotice />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor={fieldId}>Review month</Label>
              <Input
                id={fieldId}
                type="month"
                value={month}
                max={precedingMonth(clock)}
                disabled={hidden}
                onChange={(event) => {
                  if (canReveal()) setMonth(event.target.value);
                }}
              />
            </div>
            <Button disabled={hidden || !ready} onClick={review}>
              Refresh comparison
            </Button>
          </div>
          {query.isError ? (
            <div role="alert" className="space-y-2">
              <p>
                Could not load expense history. Retry before reviewing recorded
                spending.
              </p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry expense history
              </Button>
            </div>
          ) : !ready ? (
            <p role="status">
              Wait for expense history and pending saves to finish before
              reviewing.
            </p>
          ) : null}
          {current ? (
            <ReviewResults key={snapshot.id} result={snapshot.result} />
          ) : ready && !hidden ? (
            <p className="text-muted-foreground text-sm">
              Choose Refresh comparison after changing the month or expense
              history.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
