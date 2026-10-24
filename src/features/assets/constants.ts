import { chartColors } from '@/lib/chart-palette';
import type { AssetCategory } from './types';

export const CATEGORIES: AssetCategory[] = [
  'savings',
  'bonds',
  'stocks',
  'etf',
  'non_equity',
  'crypto',
  'pension',
];

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  savings: 'Savings',
  bonds: 'Bonds',
  stocks: 'Stocks',
  etf: 'ETF',
  non_equity: 'Non Equity',
  crypto: 'Crypto',
  pension: 'Pension',
};

export const CATEGORY_COLORS = chartColors<AssetCategory>({
  savings: 1,
  bonds: 4,
  stocks: 3,
  etf: 2,
  non_equity: 5,
  crypto: 7,
  pension: 12,
});

// Categories that roll up into "Total Investment" on the chart
export const INVESTMENT_CATEGORIES: AssetCategory[] = [
  'stocks',
  'etf',
  'non_equity',
  'crypto',
];

export const SCENARIO_SLICES = [
  {
    label: 'Savings',
    amount: 'savingsAmt',
    percent: 'savingsPct',
    color: 'var(--chart-1)',
  },
  {
    label: 'Expenses',
    amount: 'expensesAmt',
    percent: 'expensesPct',
    color: 'var(--loss)',
  },
  {
    label: 'Insurance',
    amount: 'insuranceAmt',
    percent: 'insurancePct',
    color: 'var(--warning)',
  },
  {
    label: 'Investment',
    amount: 'investmentAmt',
    percent: 'investmentPct',
    color: 'var(--gain)',
  },
  {
    label: 'Tithe',
    amount: 'titheAmt',
    percent: 'tithePct',
    color: 'var(--chart-5)',
    enabled: 'titheEnabled',
  },
  {
    label: 'Allowance',
    amount: 'allowanceAmt',
    percent: 'allowancePct',
    color: 'var(--chart-6)',
    enabled: 'allowanceEnabled',
  },
] as const;

export const SNAPSHOTS_KEY = ['snapshots'] as const;

export const PLANNER_KEY = ['planner-settings'] as const;
