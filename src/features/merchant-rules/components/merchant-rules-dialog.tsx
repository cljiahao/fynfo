'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAmountVisibility } from '@/features/privacy';
import { BookMarked } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { useMerchantRulebook } from '../hooks/use-merchant-rulebook';
import type { MerchantBank, MerchantRule } from '../types';
import { MerchantRuleManager } from './merchant-rule-manager';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rulebook: ReturnType<typeof useMerchantRulebook>;
  draft: MerchantRule | null;
  onDraft: (rule: MerchantRule | null) => void;
  examples: Array<{ description: string; bank: MerchantBank }>;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
};

/** Closing with an unsaved rule asks first, then drops the draft. */
export function MerchantRulesDialog({
  open,
  onOpenChange,
  rulebook,
  draft,
  onDraft,
  examples,
  onCloseAutoFocus,
}: Props) {
  const { hidden } = useAmountVisibility();
  function changeOpen(next: boolean) {
    if (next) return onOpenChange(true);
    if (draft && !window.confirm('Discard the unsaved rule?')) return;
    onDraft(null);
    onOpenChange(false);
  }
  return (
    <Dialog open={open && !hidden} onOpenChange={changeOpen}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>
            {draft ? 'Review rule' : 'Saved merchant rules'}
          </DialogTitle>
          <DialogDescription>
            Saved rules fill matching statement rows automatically. Your manual
            edits are kept.
          </DialogDescription>
        </DialogHeader>
        {!hidden && (
          <MerchantRuleManager
            embedded
            rulebook={rulebook}
            draft={draft}
            onDraft={onDraft}
            examples={examples}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StandaloneRules({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const rulebook = useMerchantRulebook();
  const [draft, setDraft] = useState<MerchantRule | null>(null);
  return (
    <MerchantRulesDialog
      open
      onOpenChange={onOpenChange}
      rulebook={rulebook}
      draft={draft}
      onDraft={setDraft}
      examples={[]}
    />
  );
}

/** Opens the saved rules without a statement; loads them only while open. */
export function MerchantRulesButton() {
  const { hidden, canReveal } = useAmountVisibility();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={hidden}
        onClick={() => canReveal() && setOpen(true)}
      >
        <BookMarked />
        Merchant rules
      </Button>
      {open && <StandaloneRules onOpenChange={setOpen} />}
    </>
  );
}
