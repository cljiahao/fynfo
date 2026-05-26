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

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  savings: '#3b82f6', // blue
  bonds: '#f59e0b', // amber
  stocks: '#10b981', // emerald
  etf: '#f97316', // orange
  non_equity: '#ec4899', // pink
  crypto: '#8b5cf6', // violet
  pension: '#92400e', // brown
};

// Categories that roll up into "Total Investment" on the chart
export const INVESTMENT_CATEGORIES: AssetCategory[] = [
  'stocks',
  'etf',
  'non_equity',
  'crypto',
];
