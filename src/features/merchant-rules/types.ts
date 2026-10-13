import type { ExpenseType } from '@/features/expenses';
import type { z } from 'zod';
import type {
  merchantRulebookPayloadSchema,
  merchantRuleSchema,
  saveRulebookSchema,
} from './schemas';

export type MerchantRule = z.infer<typeof merchantRuleSchema>;
export type MerchantRulebookPayload = z.infer<
  typeof merchantRulebookPayloadSchema
>;
export type MerchantBank = NonNullable<MerchantRule['bank']>;
export type MerchantSuggestion = {
  displayName: string | null;
  category: ExpenseType | null;
};
export type MerchantMatch =
  | { status: 'none' }
  | {
      status: 'suggestion';
      tier: MerchantRule['matchMode'];
      rules: MerchantRule[];
      suggestion: MerchantSuggestion;
    }
  | {
      status: 'conflict';
      tier: MerchantRule['matchMode'];
      rules: MerchantRule[];
    };

export type MerchantDraft = {
  description: string;
  category: ExpenseType;
  manual: { description: boolean; category: boolean };
};

export type MerchantRulebook = {
  id: string;
  revision: string;
  payload: MerchantRulebookPayload;
};
export type SaveRulebookInput = z.infer<typeof saveRulebookSchema>;
export type SaveRulebookOutcome =
  | { status: 'saved'; revision: string }
  | { status: 'not_saved' | 'unconfirmed' | 'conflict' };
