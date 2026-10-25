'use client';

import { Button } from '@/components/ui/button';
import { buildImportNote } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { IMPORT_OUTCOME_LABELS } from '../constants';
import type { useStatementSave } from '../hooks/use-statement-save';

type SaveReview = ReturnType<typeof useStatementSave>;
type Attempt = SaveReview['attempts'][string];

export function ImportOutcome({
  save,
  rowNumber,
}: {
  save: SaveReview;
  rowNumber: (key: string) => number;
}) {
  const { hidden } = useAmountVisibility();
  const entries = Object.entries(save.attempts);
  if (hidden || !entries.length) return null;
  const count = (status: Attempt['status']) =>
    entries.filter(([, attempt]) => attempt.status === status).length;
  const problems = entries.filter(
    ([, attempt]) => attempt.status !== 'confirmed'
  );
  const confirmed = entries.filter(
    ([, attempt]) => attempt.status === 'confirmed'
  );
  function label(key: string, attempt: Attempt) {
    const source = attempt.input.source[0];
    return `Row #${rowNumber(key)} · page ${source.page}, line ${source.line} · ${attempt.input.description} · SGD ${(attempt.input.cents / 100).toFixed(2)}: ${IMPORT_OUTCOME_LABELS[attempt.status]}`;
  }
  return (
    <section
      aria-label="Save outcome"
      className="max-h-48 shrink-0 space-y-2 overflow-y-auto rounded-md border p-3 text-sm"
    >
      <p role="status" className="font-medium tabular-nums">
        {count('confirmed')} confirmed · {count('not_saved')} not saved ·{' '}
        {count('unconfirmed')} unconfirmed · {count('conflict')} conflicts ·{' '}
        {count('not_started')} not started
      </p>
      {problems.map(([key, attempt]) => (
        <div key={key} className="space-y-2 border-t pt-2">
          <p
            className={
              attempt.status === 'pending' || attempt.status === 'not_started'
                ? ''
                : 'text-warning-strong'
            }
          >
            {label(key, attempt)}
          </p>
          {attempt.status === 'not_saved' && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={save.busy}
                onClick={() => save.retry(key)}
              >
                Retry same expense
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={save.busy}
                onClick={() => save.cancelRejected(key)}
              >
                Cancel rejected attempt to edit
              </Button>
            </div>
          )}
          <details>
            <summary className="text-muted-foreground cursor-pointer">
              Statement source
            </summary>
            <p className="mt-2 break-words whitespace-pre-wrap">
              {buildImportNote(attempt.input)}
            </p>
          </details>
        </div>
      ))}
      {confirmed.length > 0 && (
        <details className="border-t pt-2">
          <summary className="text-muted-foreground cursor-pointer">
            {confirmed.length} saved
          </summary>
          <ul className="mt-2 space-y-1">
            {confirmed.map(([key, attempt]) => (
              <li key={key}>{label(key, attempt)}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
