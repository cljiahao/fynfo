export type IncomeLineType = 'salary' | 'bonus' | 'one_time';

export interface IncomeLine {
  id: string;
  type: IncomeLineType;
  label: string;
  amount: number;
}

export interface SalaryMonth {
  // YYYY-MM
  id: string;
  lines: IncomeLine[];
}

/**
 * Per-month shape consumers read. `salary` and `bonus` mirror the legacy
 * columns (recurring sum, bonus sum) so existing consumers keep working.
 */
export interface SalaryData extends SalaryMonth {
  salary: number;
  bonus: number;
  recurring: number;
  oneTime: number;
  total: number;
}

export interface TaxReliefData {
  reliefKey: string;
  amount: number;
}

export interface ReliefVariant {
  value: string;
  label: string;
  amount: number;
}

export interface ReliefDefinition {
  key: string;
  label: string;
  defaultAmount: number;
  description: string;
  maxCount?: number;
  variants?: ReliefVariant[];
}
