'use client';

import { Button } from '@/components/ui/button';
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { matchMerchantRules } from '../lib/matching';
import type {
  MerchantBank,
  MerchantRule,
  MerchantSuggestion as Suggestion,
} from '../types';

export function MerchantSuggestion({
  originalDescription,
  bank,
  rules,
  manual,
  onApply,
}: {
  originalDescription: string;
  bank: MerchantBank;
  rules: MerchantRule[];
  manual: { description: boolean; category: boolean };
  onApply: (
    suggestion: Suggestion,
    replace: { description: boolean; category: boolean }
  ) => void;
}) {
  const { hidden, canReveal } = useAmountVisibility();
  if (hidden) return null;
  const match = matchMerchantRules(originalDescription, bank, rules);
  if (match.status !== 'conflict') return null;
  const choices = match.rules;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-warning-strong">
        Matching rules disagree. Choose a rule for this row.
      </p>
      {choices.map((rule) => (
        <div key={rule.id} className="space-y-1">
          <p className="break-words">
            {rule.label}:{rule.displayName ?? 'Keep item / brand'} ·{' '}
            {rule.category
              ? EXPENSE_TYPE_LABELS[rule.category]
              : 'Keep category'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (canReveal())
                  onApply(rule, { description: false, category: false });
              }}
            >
              Choose {rule.label}
            </Button>
            {manual.description && rule.displayName !== null && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (
                    canReveal() &&
                    window.confirm(
                      'Replace your manually edited item / brand with this suggestion?'
                    )
                  )
                    onApply(
                      { displayName: rule.displayName, category: null },
                      { description: true, category: false }
                    );
                }}
              >
                Replace my item / brand
              </Button>
            )}
            {manual.category && rule.category !== null && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (
                    canReveal() &&
                    window.confirm(
                      'Replace your manually chosen category with this suggestion?'
                    )
                  )
                    onApply(
                      { displayName: null, category: rule.category },
                      { description: false, category: true }
                    );
                }}
              >
                Replace my category
              </Button>
            )}
          </div>
        </div>
      ))}
      {choices.length > 0 && (manual.description || manual.category) && (
        <p className="text-muted-foreground">
          Choosing a rule preserves your manual changes. Use a replacement
          button to change a protected field.
        </p>
      )}
    </div>
  );
}
