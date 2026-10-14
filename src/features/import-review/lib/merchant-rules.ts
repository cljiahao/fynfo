import type { ExpenseType } from '@/features/expenses';
import {
  applyMerchantSuggestion,
  matchMerchantRules,
  type MerchantRule,
} from '@/features/merchant-rules';
import type { StatementBank, StatementCandidate } from '../types';

/** Update only untouched draft fields; saved attempts and source text are immutable. */
export function applyRulesToStatement(
  rows: StatementCandidate[],
  bank: StatementBank,
  rules: MerchantRule[],
  locked: (id: string) => boolean
): StatementCandidate[] {
  let changed = false;
  const next = rows.map((row) => {
    if (row.isSummary || locked(row.id)) return row;
    const match = matchMerchantRules(row.originalDescription, bank, rules);
    if (match.status !== 'suggestion') return row;
    const applied = applyMerchantSuggestion(
      {
        description: row.description,
        category: row.category as ExpenseType,
        manual: row.manualMerchant,
      },
      match.suggestion
    );
    if (
      applied.description === row.description &&
      applied.category === row.category
    )
      return row;
    changed = true;
    return {
      ...row,
      description: applied.description,
      category: applied.category,
    };
  });
  return changed ? next : rows;
}
