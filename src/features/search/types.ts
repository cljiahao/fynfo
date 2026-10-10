import type { SnapshotData } from '@/features/assets';
import type { DividendData, EquityTradeData } from '@/features/equity';
import type { ExpenseData } from '@/features/expenses';
import type { SalaryData } from '@/features/salary';
import type { SEARCH_SOURCES } from './constants';

export type SearchSource = (typeof SEARCH_SOURCES)[number]['key'];

export interface SearchHistories {
  snapshots: readonly SnapshotData[];
  salary: readonly SalaryData[];
  expenses: readonly ExpenseData[];
  trades: readonly EquityTradeData[];
  dividends: readonly DividendData[];
}

export interface SearchResult {
  key: string;
  label: string;
  context: string;
  href: string;
  action: string;
}

export interface SearchGroup {
  results: SearchResult[];
  more: boolean;
}

export interface RecordSearchTaskProps {
  onSelect: () => void;
}
