'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import type { RefObject } from 'react';
import type { useStatementSave } from '../hooks/use-statement-save';
import type { StatementCandidate } from '../types';

export function RestoreMerchantDialog({
  restoreRow,
  origin,
  save,
  onClose,
  onRestore,
}: {
  restoreRow: StatementCandidate | undefined;
  origin: RefObject<HTMLElement | null>;
  save: ReturnType<typeof useStatementSave>;
  onClose: () => void;
  onRestore: (rowId: string) => void;
}) {
  const { hidden } = useAmountVisibility();
  return (
    <Dialog
      open={!!restoreRow && !hidden}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          origin.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Restore item and category</DialogTitle>
          <DialogDescription>
            Compare your edits with the extracted values before restoring.
          </DialogDescription>
        </DialogHeader>
        {!hidden && restoreRow && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="min-w-0 space-y-2">
                <h3 className="font-medium">Current</h3>
                <p className="break-words">
                  Item / Brand: {restoreRow.description}
                </p>
                <p>
                  Category:{' '}
                  {EXPENSE_TYPE_LABELS[restoreRow.category as ExpenseType]}
                </p>
              </div>
              <div className="min-w-0 space-y-2">
                <h3 className="font-medium">Restore to</h3>
                <p className="break-words">
                  Item / Brand: {restoreRow.originalDescription}
                </p>
                <p>Category: Other</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Other is the initial category; bank PDFs do not supply an expense
              category.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Keep edits
              </Button>
              <Button
                disabled={save.busy || save.locked(restoreRow.id)}
                onClick={() => {
                  onRestore(restoreRow.id);
                  onClose();
                }}
              >
                Restore values
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
