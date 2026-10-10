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
  // YYYY-MM
  id: string;
  entries: AssetEntryData[];
}

export interface SnapshotVersion {
  snapshotId: string;
  revision: string;
}

export type SnapshotRecord = SnapshotData & SnapshotVersion;

export type SnapshotWriteResult =
  | { ok: true }
  | { ok: false; code: 'CONFLICT' };

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

export interface ScenarioPayload {
  schemaVersion: 1;
  name: string;
  model: 'allocation-flat-cpf-v1';
  currency: 'SGD';
  capturedAt: string;
  sourceSnapshotMonth?: string;
  inputs: import('./lib/salary-plan').SalaryPlanInput;
}

export interface ScenarioRecord {
  id: string;
  creationRequestId: string;
  revision: string;
  createdAt: string;
  updatedAt: string;
  payload: ScenarioPayload;
}

export type ScenarioCreateResult =
  | { status: 'CREATED' | 'EXISTING'; id: string; revision: string }
  | { status: 'CAPACITY' | 'CONFLICT' };
export type ScenarioSaveResult =
  | { status: 'SAVED'; revision: string }
  | { status: 'CONFLICT' };
export type ScenarioDeleteResult = { status: 'DELETED' | 'CONFLICT' };
