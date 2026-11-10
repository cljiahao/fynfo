'use client';

import { useAmountVisibility } from '@/features/privacy';
import type { StatementReconciliation } from '../lib/statement-guards';

const sgd = (cents: number) => `SGD ${(Math.abs(cents) / 100).toFixed(2)}`;

/** Shown for scanned statements only: OCR can misread a digit, so the parsed
 * rows are checked against the statement's own total when it has one. */
export function StatementReconciliationNotice({
  reconciliation,
}: {
  reconciliation: StatementReconciliation;
}) {
  const { hidden } = useAmountVisibility();
  if (
    reconciliation.status === 'not_ocr' ||
    reconciliation.status === 'matched'
  )
    return null;
  if (reconciliation.status === 'unchecked')
    return (
      <p
        role="status"
        className="text-muted-foreground border-b px-3 py-2 text-sm"
      >
        Total not checked: this statement layout has no total to compare, so
        check each amount against the statement.
      </p>
    );
  return (
    <div
      role="alert"
      className="border-warning bg-warning-subtle text-warning-strong space-y-1 rounded-md border p-3 text-sm"
    >
      <p className="font-medium">
        Parsed rows do not add up to the statement total. Select all is off;
        compare each row with the statement.
      </p>
      {!hidden && (
        <ul className="tabular-nums">
          {reconciliation.mismatches.map((mismatch, index) => (
            <li key={`${index}-${mismatch.totalCents}-${mismatch.parsedCents}`}>
              Statement {sgd(mismatch.totalCents)}, rows{' '}
              {sgd(mismatch.parsedCents)}: difference{' '}
              {mismatch.differenceCents < 0 ? '-' : '+'}
              {sgd(mismatch.differenceCents)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
