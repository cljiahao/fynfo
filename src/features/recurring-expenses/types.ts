import type { z } from 'zod';
import type {
  recurringDefinitionSchema,
  recurringExpenseSchema,
  recurringMutationSchema,
  recurringPayloadSchema,
  recurringReceiptSchema,
  recurringTemplateSchema,
} from './schemas';
export type RecurringDefinition = z.infer<typeof recurringDefinitionSchema>;
export type RecurringExpense = z.infer<typeof recurringExpenseSchema>;
export type RecurringMutation = z.infer<typeof recurringMutationSchema>;
export type RecurringPayload = z.infer<typeof recurringPayloadSchema>;
export type RecurringReceipt = z.infer<typeof recurringReceiptSchema>;
export type RecurringTemplate = z.infer<typeof recurringTemplateSchema>;
export type RecurringBook = {
  id: string;
  revision: string;
  payload: RecurringPayload;
};
export type RecurringOutcome = {
  status: 'saved' | 'not_saved' | 'unconfirmed' | 'conflict';
};
