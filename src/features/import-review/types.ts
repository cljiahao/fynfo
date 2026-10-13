export type StatementBank = 'uob' | 'dbs' | 'hsbc' | 'citibank';
export interface StatementPeriod {
  from: string;
  to: string;
}
export interface StatementLine {
  page: number;
  line: number;
  text: string;
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
  amount: string;
  category: string;
  classification: StatementClassification;
  suggestedClassification: StatementClassification;
  classificationReason: string;
  isSummary: boolean;
  status: 'candidate' | 'unresolved' | 'excluded';
  issues: string[];
}
export interface PositionedStatementText {
  text: string;
  x: number;
  y: number;
}
