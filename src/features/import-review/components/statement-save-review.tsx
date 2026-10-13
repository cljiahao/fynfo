'use client';

import { Button } from '@/components/ui/button';
import { buildImportNote } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { IMPORT_OUTCOME_LABELS } from '../constants';
import type { useStatementSave } from '../hooks/use-statement-save';

type SaveReview = ReturnType<typeof useStatementSave>;

export function StatementSaveReview({ save }: { save: SaveReview }) {
  const { hidden, canReveal } = useAmountVisibility();
  return (
    <section
      aria-label="Save selected statement expenses"
      className="space-y-3 border-t pt-4"
    >
      {!hidden && (
        <p className="text-sm tabular-nums">
          {save.selection.length} selected · SGD {save.total.toFixed(2)}
        </p>
      )}
      {!hidden && save.selection.length > 20 && (
        <p role="status" className="text-warning-strong text-sm">
          Select up to 20 purchases at a time to continue.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={save.reviewed ? 'outline' : 'default'}
          disabled={hidden || save.busy || !save.ready}
          onClick={() => void save.compare()}
        >
          Check possible duplicates
        </Button>
        <Button
          type="button"
          variant={save.reviewed ? 'default' : 'outline'}
          disabled={hidden || save.busy || !save.reviewed || save.unresolved}
          onClick={() => void save.save()}
        >
          Save selected expenses
        </Button>
      </div>
      <details className="text-muted-foreground text-sm">
        <summary className="cursor-pointer">What gets saved</summary>
        <p className="mt-2">
          Self expenses in SGD only, up to 20 per batch. Each expense includes
          its original transaction text in an encrypted source note. Duplicate
          warnings do not guarantee prevention across imports.
        </p>
      </details>
      {!hidden && save.duplicateIds.length > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={save.acknowledged}
            disabled={save.busy}
            onChange={(event) => {
              if (canReveal()) save.setAcknowledged(event.target.checked);
            }}
          />
          I compared the possible duplicate source rows and want to save these
          selected purchases.
        </label>
      )}
      {!hidden &&
        save.duplicateSources.map((source) => (
          <p
            key={`${source.page}:${source.line}`}
            className="text-warning-strong text-sm"
          >
            Possible duplicate: source page {source.page}, line {source.line}.
            Compare the original and existing expense before acknowledging.
          </p>
        ))}
      {!hidden && Object.keys(save.attempts).length > 0 && (
        <p role="status" className="text-sm">
          {
            Object.values(save.attempts).filter(
              (attempt) => attempt.status === 'confirmed'
            ).length
          }{' '}
          confirmed ·{' '}
          {
            Object.values(save.attempts).filter(
              (attempt) => attempt.status === 'not_saved'
            ).length
          }{' '}
          not saved ·{' '}
          {
            Object.values(save.attempts).filter(
              (attempt) => attempt.status === 'unconfirmed'
            ).length
          }{' '}
          unconfirmed ·{' '}
          {
            Object.values(save.attempts).filter(
              (attempt) => attempt.status === 'conflict'
            ).length
          }{' '}
          conflicts ·{' '}
          {
            Object.values(save.attempts).filter(
              (attempt) => attempt.status === 'not_started'
            ).length
          }{' '}
          not started
        </p>
      )}
      {!hidden && save.message && (
        <p role="status" className="text-sm">
          {save.message}
        </p>
      )}
      {!hidden &&
        Object.entries(save.attempts).map(([key, attempt]) => (
          <div key={key} className="space-y-2 text-sm">
            <p role="status">
              Source page {attempt.input.source[0].page}, line{' '}
              {attempt.input.source[0].line}:{' '}
              {IMPORT_OUTCOME_LABELS[attempt.status]}
            </p>
            {attempt.status === 'not_saved' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.busy}
                  onClick={() => save.retry(key)}
                >
                  Retry same expense
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.busy}
                  onClick={() => save.cancelRejected(key)}
                >
                  Cancel rejected attempt to edit
                </Button>
              </div>
            )}
            <details>
              <summary className="cursor-pointer">
                Submitted source note
              </summary>
              <p className="mt-2 break-words whitespace-pre-wrap">
                {buildImportNote(attempt.input)}
              </p>
            </details>
          </div>
        ))}
      <div className="flex flex-wrap gap-2">
        {Object.values(save.attempts).some(
          (attempt) => attempt.status === 'unconfirmed'
        ) && (
          <Button
            type="button"
            variant="outline"
            disabled={hidden || save.busy}
            onClick={() => void save.check()}
          >
            Check saved expenses
          </Button>
        )}
        {Object.values(save.attempts).some(
          (attempt) => attempt.status === 'not_started'
        ) && (
          <Button
            type="button"
            variant="outline"
            disabled={hidden || save.busy || save.unresolved}
            onClick={save.continueBatch}
          >
            Continue frozen batch
          </Button>
        )}
      </div>
    </section>
  );
}
