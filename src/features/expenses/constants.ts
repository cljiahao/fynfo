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

export const EXPENSE_TYPE_COLORS: Record<ExpenseType, string> = {
  bills: '#6366f1',
  charity: '#a855f7',
  electronics: '#3b82f6',
  entertainment: '#ec4899',
  food_drink: '#f97316',
  gift: '#d946ef',
  groceries: '#22c55e',
  health: '#ef4444',
  insurance: '#eab308',
  other: '#94a3b8',
  shopping: '#14b8a6',
  subscriptions: '#8b5cf6',
  transport: '#0ea5e9',
  travel: '#f43f5e',
};
