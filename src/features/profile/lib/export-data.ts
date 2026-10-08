import type {
  PlannerSettingsData,
  SnapshotData,
} from '@/features/assets/types';
import type { DividendData, EquityTradeData } from '@/features/equity/types';
import type { ExpenseData } from '@/features/expenses/types';
import type { SalaryData, TaxReliefData } from '@/features/salary/types';
import type { ProfileData } from '../types';

/** Envelope schema version. Bump when `ExportData` shape changes; a future
 *  import branches on this to migrate older backups. */
export const EXPORT_VERSION = 2;

/** A tax-relief row carrying its year (reliefs are stored per year). */
export type TaxReliefExport = TaxReliefData & { year: number };

export interface ExportData {
  profile: ProfileData | null;
  snapshots: SnapshotData[];
  expenses: ExpenseData[];
  salary: SalaryData[];
  taxReliefs: TaxReliefExport[];
  trades: EquityTradeData[];
  dividends: DividendData[];
  plannerSettings: PlannerSettingsData | null;
}

export interface ExportEnvelope {
  version: number;
  app: 'fynfo';
  // ISO timestamp
  exportedAt: string;
  data: ExportData;
}

/** Wrap the decrypted domain data in the versioned export envelope. Pure. */
export function buildExportEnvelope(
  data: ExportData,
  exportedAt: string
): ExportEnvelope {
  return { version: EXPORT_VERSION, app: 'fynfo', exportedAt, data };
}

/** Pretty-printed JSON for the downloaded file. */
export function serializeExport(envelope: ExportEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/** `fynfo-backup-YYYY-MM-DD.json` for the given date. */
export function exportFileName(date: Date): string {
  return `fynfo-backup-${date.toISOString().slice(0, 10)}.json`;
}
