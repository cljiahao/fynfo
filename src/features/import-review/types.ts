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
export interface StatementCandidate {
  id: string;
  source: StatementLine[];
  date: string;
  description: string;
  amount: string;
  category: string;
  status: 'candidate' | 'unresolved' | 'excluded';
  issues: string[];
}
export interface PositionedStatementText {
  text: string;
  x: number;
  y: number;
}
