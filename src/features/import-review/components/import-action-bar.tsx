'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { IMPORT_SAVE_LIMIT } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { Info } from 'lucide-react';
import type { useStatementSave } from '../hooks/use-statement-save';

type SaveReview = ReturnType<typeof useStatementSave>;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

interface ImportActionBarProps {
  save: SaveReview;
  eligibleCount: number;
  onSelectAll: () => void;
  onNextDuplicate: () => void;
}

/** One primary action for the current step, with the reason beside it. */
export function ImportActionBar({
  save,
  eligibleCount,
  onSelectAll,
  onNextDuplicate,
}: ImportActionBarProps) {
  const { hidden } = useAmountVisibility();
  const attempts = Object.values(save.attempts);
  const notStarted = attempts.filter(
    (attempt) => attempt.status === 'not_started'
  ).length;
  const selected = save.selection.length;
  const duplicatesResolved = save.duplicateCount - save.openDuplicates.length;

  let status: string;
  let action: { label: string; run: () => void; disabled?: boolean };
  if (attempts.some((attempt) => attempt.status === 'unconfirmed')) {
    status =
      'Some saves are unconfirmed. Check saved expenses before going on.';
    action = { label: 'Check saved expenses', run: () => void save.check() };
  } else if (attempts.some((attempt) => attempt.status === 'conflict')) {
    status =
      'A saved record changed elsewhere. Review it in the outcome list; saving is paused for this review.';
    action = { label: 'Saving paused', run: () => {}, disabled: true };
  } else if (notStarted > 0) {
    status = `${plural(notStarted, 'expense')} in this batch not sent yet.`;
    action = {
      label: `Continue saving ${notStarted}`,
      run: save.continueBatch,
    };
  } else if (selected === 0) {
    status = eligibleCount
      ? 'Select the expenses to import.'
      : 'No expenses left to select in this view.';
    action = {
      label:
        eligibleCount > IMPORT_SAVE_LIMIT
          ? `Select next ${IMPORT_SAVE_LIMIT} expenses`
          : `Select all ${plural(eligibleCount, 'expense')}`,
      run: onSelectAll,
      disabled: eligibleCount === 0,
    };
  } else if (selected > IMPORT_SAVE_LIMIT) {
    status = `Select up to ${IMPORT_SAVE_LIMIT} purchases at a time to continue.`;
    action = { label: 'Too many selected', run: () => {}, disabled: true };
  } else if (!save.ready) {
    status =
      'A selected row cannot be saved yet. Fix the details marked on it, or deselect it.';
    action = { label: 'Fix selected rows', run: () => {}, disabled: true };
  } else if (save.pendingCount > 0) {
    const need = save.pendingCount === 1 ? 'needs' : 'need';
    status = !save.recheck
      ? 'Not checked for duplicates yet.'
      : save.awaitingAmend === save.pendingCount
        ? `Correct the ${plural(save.awaitingAmend, 'row')} marked Needs amend, then recheck.`
        : `${plural(save.pendingCount, 'row')} ${need} a recheck.`;
    action = {
      label: save.recheck
        ? `Recheck ${plural(save.pendingCount, 'row')}`
        : `Check ${save.pendingCount} for duplicates`,
      run: () => void save.compare(),
    };
  } else if (save.openDuplicates.length > 0) {
    status = `${duplicatesResolved} of ${plural(save.duplicateCount, 'possible duplicate')} resolved. Compare each with its source line.`;
    action = { label: 'Go to next duplicate', run: onNextDuplicate };
  } else {
    status = save.duplicateCount
      ? `Ready. ${save.duplicateCount} possible duplicate${save.duplicateCount === 1 ? '' : 's'} kept after comparison.`
      : 'Ready to save.';
    action = {
      label: `Save ${plural(selected, 'expense')}`,
      run: () => void save.save(),
    };
  }

  return (
    <div className="bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 border-t pt-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        {!hidden && (
          <p className="text-sm font-medium tabular-nums">
            {selected} selected · SGD {save.total.toFixed(2)}
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-sm"
        >
          {hidden ? 'Show amounts to continue.' : status}
        </p>
        {!hidden && save.message && (
          <p role="status" className="text-muted-foreground text-xs">
            {save.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="About transaction selection"
            >
              <Info className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">
            Select purchases, check them for duplicates, then save. Repayments
            are hidden here. Refunds can be reviewed but are not added as
            expenses. Larger selections are saved in automatic groups.
          </PopoverContent>
        </Popover>
        {selected > 0 && (
          <Button
            type="button"
            variant="ghost"
            disabled={hidden || save.busy}
            onClick={save.clearSelection}
          >
            Clear selection
          </Button>
        )}
        <Button
          type="button"
          disabled={hidden || save.busy || action.disabled}
          onClick={action.run}
        >
          {action.label}
        </Button>
      </div>
    </div>
  );
}
