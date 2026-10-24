import { chartColors } from '@/lib/chart-palette';
import type { ExpenseType } from './types';

export const EXPENSE_TYPES: ExpenseType[] = [
  'bills',
  'charity',
  'electronics',
  'entertainment',
  'food_drink',
  'gift',
  'groceries',
  'health',
  'insurance',
  'other',
  'shopping',
  'subscriptions',
  'transport',
  'travel',
];

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  bills: 'Bills',
  charity: 'Charity',
  electronics: 'Electronics',
  entertainment: 'Entertainment',
  food_drink: 'Food & Drink',
  gift: 'Gift',
  groceries: 'Groceries',
  health: 'Health',
  insurance: 'Insurance',
  other: 'Other',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
  transport: 'Transport',
  travel: 'Travel',
};

/**
 * Types excluded from "total expenses" aggregates (chart headline/avg, salary
 * planner's expensesPct) — insurance is modelled separately by the salary
 * planner as its own fixed slice, so folding it into "expenses" too would
 * double-count it. Still loggable and still shown per-category.
 */
export const EXPENSE_TOTAL_EXCLUDED_TYPES: readonly ExpenseType[] = [
  'insurance',
];

export const EXPENSE_TYPE_COLORS = chartColors<ExpenseType>({
  bills: 13,
  charity: 7,
  electronics: 1,
  entertainment: 5,
  food_drink: 2,
  gift: 10,
  groceries: 6,
  health: 8,
  insurance: 4,
  other: 14,
  shopping: 9,
  subscriptions: 12,
  transport: 3,
  travel: 11,
});

export const EXPENSE_PASTE_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;
export const EXPENSE_PASTE_ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
export const EXPENSE_PASTE_SLASH_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
export const EXPENSE_PASTE_NAMED_DATE =
  /^(?:([a-z]+)\s+(\d{1,2})(?:,\s*|\s+)(\d{4})|(\d{1,2})\s+([a-z]+)(?:,\s*|\s+)(\d{4}))$/i;
export const EXPENSE_PASTE_MONEY =
  /^\$?\s*(?:\d+(?:\.\d*)?|\.\d+|\d{1,3}(?:,\d{3})+(?:\.\d*)?)$/;
export const EXPENSE_PASTE_MONEY_CANDIDATE =
  /^(?:[+-]?\$?\s*[+-]?[\d,.\s]+|\([+-]?\$?\s*[+-]?[\d,.\s]+\))$/;
export const EXPENSE_PASTE_CREDIT =
  /^(?:\(?-?\$?\s*-?[\d,.]+\)?\s*(?:CR|CREDIT)|(?:CR|CREDIT)\s*\$?[\d,.]+)$/i;
export const EXPENSE_PASTE_NONDECIMAL_MONEY =
  /^(?:NaN|[+-]?Infinity|[+-]?(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+|[\d$,.+\-()\s]+(?:DR|DEBIT))$/i;
export const EXPENSE_PASTE_MONTH_ALIASES: Readonly<Record<string, number>> = {
  sept: 9,
};

export const EXPENSE_KEY = ['expenses'] as const;

/** Fixed household review heuristic; not a statistical significance threshold. */
export const EXPENSE_ANOMALY_BASELINE_MONTHS = 3;
export const EXPENSE_ANOMALY_MULTIPLIER = 2;
export const EXPENSE_ANOMALY_MINIMUM_EXCESS_CENTS = 5000;
export const EXPENSE_ANOMALY_SOURCE_PAGE_SIZES = [10] as const;

export const EXPENSE_ANOMALY_CATEGORY_MESSAGES = {
  'missing-history':
    'Recorded category history is missing for one or more comparison months.',
  'invalid-record':
    'A recorded amount or shared allocation needs review before comparison.',
  'unsafe-total': 'Recorded totals exceed the supported comparison range.',
  'zero-baseline':
    'The recorded baseline is zero; no ratio comparison is made.',
} as const;
export const EXPENSE_ANOMALY_REVIEW_MESSAGES = {
  'invalid-month':
    'Choose a valid review month with three preceding calendar months.',
  'month-not-elapsed':
    'Choose a fully elapsed month before the current Singapore month.',
  'invalid-date':
    'A recorded expense date cannot be assigned to a comparison window.',
  'invalid-metadata': 'Recorded category, split type or identity needs review.',
  'duplicate-id': 'Repeated record identities prevent a reliable comparison.',
} as const;

// Internal group size bounds the encrypted action payload; selection is separate.
export const IMPORT_SAVE_LIMIT = 500;
export const IMPORT_SAVE_GROUP_SIZE = 20;
export const IMPORT_REQUEST_TIMEOUT_MS = 30_000;
export const IMPORT_SERVER_STEP_TIMEOUT_MS = 8_000;
export const IMPORT_SAVE_MAX_BYTES = 512 * 1024;
export const EXPENSE_READ_TIMEOUT_MS = 15_000;
