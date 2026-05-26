export type AssetCategory =
  | 'savings'
  | 'bonds'
  | 'stocks'
  | 'etf'
  | 'non_equity'
  | 'crypto'
  | 'pension';

export interface AssetEntryData {
  category: AssetCategory;
  account: string;
  amount: number;
}

export interface SnapshotData {
  id: string; // YYYY-MM
  entries: AssetEntryData[];
}

export interface SnapshotWithTotals extends SnapshotData {
  total: number;
}

export interface ChartDataPoint {
  month: string;
  id: string;
  savings: number;
  bonds: number;
  stocks: number;
  etf: number;
  non_equity: number;
  crypto: number;
  pension: number;
  total: number;
  total_investment: number;
  excl_pension: number;
}

export interface PlannerSettingsData {
  emergencyMonths: number;
  warChestMonths: number;
  titheEnabled: boolean;
  tithePct: number;
  allowanceEnabled: boolean;
  allowancePct: number;
}
