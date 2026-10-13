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
  onRestore,
}: {
  originalDescription: string;
  bank: MerchantBank;
  rules: MerchantRule[];
  manual: { description: boolean; category: boolean };
  onApply: (
    suggestion: Suggestion,
    replace: { description: boolean; category: boolean }
  ) => void;
  onRestore: () => void;
}) {
  const { hidden, canReveal } = useAmountVisibility();
  if (hidden) return null;
  const match = matchMerchantRules(originalDescription, bank, rules);
  if (match.status === 'none') return null;
  const choices = match.status === 'conflict' ? match.rules : [match.rules[0]];
  return (
    <div className="space-y-2 border-t pt-2 text-sm">
      <p className="break-words">Original merchant: {originalDescription}</p>
      {match.status === 'conflict' ? (
        <p className="text-warning-strong">
          Matching rules disagree. Review and choose a suggestion.
        </p>
      ) : (
        <p className="text-muted-foreground break-words">
          {match.tier === 'exact' ? 'Exact' : 'Phrase'} match ·{' '}
          {match.rules.map((rule) => rule.label).join(', ')}
        </p>
      )}
      {choices.map((rule) => (
        <div key={rule.id} className="space-y-1">
          <p className="break-words">
            {match.status === 'conflict' && `${rule.label}: `}
            {rule.displayName ?? 'Keep merchant name'} ·{' '}
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
              Apply {match.status === 'conflict' ? rule.label : 'suggestion'}
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
                      'Replace your manually edited merchant name with this suggestion?'
                    )
                  )
                    onApply(
                      { displayName: rule.displayName, category: null },
                      { description: true, category: false }
                    );
                }}
              >
                Replace my merchant name
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
      {(manual.description || manual.category) && (
        <p className="text-muted-foreground">
          Apply preserves your manual changes. Use a replacement button to
          change a protected field.
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="link"
        onClick={() => {
          if (canReveal()) onRestore();
        }}
      >
        Restore original merchant and category
      </Button>
    </div>
  );
}
