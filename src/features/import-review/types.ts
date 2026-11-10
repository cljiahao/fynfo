import type { ExpenseSplitData } from '@/features/expenses';

export type StatementBank = 'uob' | 'dbs' | 'hsbc' | 'citibank' | 'paylah';
export type StatementBankChoice = StatementBank | 'auto';
export interface StatementPeriod {
  from: string;
  to: string;
}
export interface StatementWord {
  text: string;
  x: number;
  confidence?: number;
}
export interface StatementLine {
  page: number;
  line: number;
  text: string;
  /** Lowest word confidence on the line (0-100); absent for text-layer lines. */
  confidence?: number;
  /** Positioned words, kept for OCR lines so a layout can split side-by-side
   * columns that OCR merged into one line. Absent for text-layer lines. */
  words?: StatementWord[];
}
export type StatementClassification =
  | 'expense'
  | 'refund'
  | 'transfer'
  | 'card_repayment'
  | 'other_credit'
  | 'unknown';
export interface StatementCandidate {
  id: string;
  source: StatementLine[];
  date: string;
  description: string;
  originalDescription: string;
  note?: string;
  splits?: ExpenseSplitData[];
  manualMerchant: { description: boolean; category: boolean };
  amount: string;
  category: string;
  classification: StatementClassification;
  suggestedClassification: StatementClassification;
  classificationReason: string;
  isSummary: boolean;
  status: 'candidate' | 'unresolved' | 'excluded';
  issues: string[];
  /** Lowest line confidence across the row's source (0-100); OCR rows only. */
  confidence?: number;
}
/** A statement total and the rows (by first-line id) it should add up to. */
export interface StatementTotalBlock {
  totalCents: number;
  rowIds: string[];
}
export interface PositionedStatementText {
  text: string;
  x: number;
  y: number;
  height?: number;
  /** 0-100 recognition confidence; absent for text-layer items. */
  confidence?: number;
}
export interface StatementLineBox {
  y: number;
  height: number;
}
export type DuplicateMatch =
  | { kind: 'saved'; date: string; item: string; amount: number }
  | { kind: 'statement'; rowId: string };
export type DuplicateResolution = 'keep' | 'skip' | 'amend';
