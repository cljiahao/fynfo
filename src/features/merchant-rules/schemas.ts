import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/features/expenses';
import { z } from 'zod';
import {
  MERCHANT_BANKS,
  MERCHANT_MATCH_MODES,
  MERCHANT_RULE_LIMITS,
} from './constants';

const text = z
  .string()
  .min(1)
  .max(MERCHANT_RULE_LIMITS.text)
  .refine((value) => value.trim().length > 0, 'Enter a value.');
const category = z.custom<ExpenseType>(
  (value) =>
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(EXPENSE_TYPE_LABELS, value),
  'Choose an expense category.'
);

export const merchantRuleSchema = z
  .strictObject({
    id: z.uuid(),
    label: text,
    enabled: z.boolean(),
    matchMode: z.enum(MERCHANT_MATCH_MODES),
    matchText: text.refine(
      (value) => /[\p{L}\p{N}]/u.test(value),
      'Enter merchant text.'
    ),
    bank: z.enum(MERCHANT_BANKS).nullable(),
    displayName: text.nullable(),
    category: category.nullable(),
  })
  .refine(
    (rule) => rule.displayName !== null || rule.category !== null,
    'Suggest a merchant name or category.'
  );

export const merchantRulesSchema = z
  .array(merchantRuleSchema)
  .max(MERCHANT_RULE_LIMITS.rules)
  .refine(
    (rules) => new Set(rules.map((rule) => rule.id)).size === rules.length,
    'Rule identities must be unique.'
  );

export const merchantRulebookPayloadSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    requestId: z.uuid(),
    rules: merchantRulesSchema,
  })
  .refine(
    (payload) =>
      new TextEncoder().encode(JSON.stringify(payload)).length <=
      MERCHANT_RULE_LIMITS.payloadBytes,
    'Merchant rules exceed the supported size.'
  );

export const rulebookRevisionSchema = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((value) => value.length < 19 || value <= '9223372036854775807');
export const saveRulebookSchema = z.strictObject({
  id: z.uuid(),
  expectedRevision: z
    .union([z.literal('0'), rulebookRevisionSchema])
    .refine((value) => value !== '9223372036854775807'),
  payload: merchantRulebookPayloadSchema,
});
