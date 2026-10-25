'use client';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { useAmountVisibility } from '@/features/privacy';
import { CircleCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { STATEMENT_BANKS } from '../constants';
import type { useStatementSave } from '../hooks/use-statement-save';
import type { StatementBank, StatementPeriod } from '../types';

interface ImportCompleteProps {
  save: ReturnType<typeof useStatementSave>;
  bank: StatementBank;
  period: StatementPeriod;
  remaining: number;
  onAnother: () => void;
}

export function ImportComplete({
  save,
  bank,
  period,
  remaining,
  onAnother,
}: ImportCompleteProps) {
  const { mask } = useAmountVisibility();
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    done.current?.focus();
  }, []);
  const count = Object.keys(save.attempts).length;
  const bankLabel = STATEMENT_BANKS.find(
    (entry) => entry.value === bank
  )?.label;
  return (
    <section
      aria-labelledby="import-complete-title"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center"
    >
      <CircleCheck className="text-gain size-12" aria-hidden="true" />
      <div className="space-y-2">
        <h3 id="import-complete-title" className="text-xl font-semibold">
          {count} expense{count === 1 ? '' : 's'} saved
        </h3>
        <p className="text-muted-foreground text-sm tabular-nums">
          SGD {mask(save.savedTotal.toFixed(2))} from your {bankLabel}{' '}
          statement, {period.from} to {period.to}.
        </p>
        {(save.kept > 0 || save.skipped > 0) && (
          <p className="text-muted-foreground text-sm">
            Possible duplicates: {save.kept} kept, {save.skipped} skipped.
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <DialogClose asChild>
          <Button ref={done} type="button">
            Done
          </Button>
        </DialogClose>
        <Button type="button" variant="outline" onClick={onAnother}>
          Import another statement
        </Button>
        {remaining > 0 && (
          <Button type="button" variant="ghost" onClick={save.dismissComplete}>
            Back to {remaining} unsaved row{remaining === 1 ? '' : 's'}
          </Button>
        )}
      </div>
    </section>
  );
}
