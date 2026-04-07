export interface SalaryData {
  id: string; // YYYY-MM
  salary: number;
  bonus: number;
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
