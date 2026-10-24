'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';

export function ReuseConfirmDialog({
  mode,
  onClose,
  onKeep,
  onConfirm,
  onCloseFocus,
}: {
  mode: 'cancel' | 'replace' | null;
  onClose: () => void;
  onKeep: () => void;
  onConfirm: () => void;
  onCloseFocus: () => void;
}) {
  const { hidden } = useAmountVisibility();
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
      >
        <DialogTitle>
          {mode === 'cancel'
            ? 'Discard changes to this draft?'
            : 'Replace current draft?'}
        </DialogTitle>
        <DialogDescription>
          Your current unsaved inputs will be discarded. No expense will be
          saved.
        </DialogDescription>
        <AmountsHiddenNotice />
        <DialogFooter>
          <Button variant="outline" onClick={onKeep}>
            Keep draft
          </Button>
          <Button disabled={hidden} onClick={onConfirm}>
            {mode === 'cancel' ? 'Discard draft' : 'Replace draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
