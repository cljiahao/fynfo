import { STATEMENT_BANKS } from '../constants';
import type { StatementBank, StatementLine } from '../types';
import { getStatementLayout, LAYOUT_PRECEDENCE } from './statement-layouts';
import { matchesStatementIdentity } from './statement-parser';

export type BankDetection =
  | { status: 'match'; bank: StatementBank }
  | { status: 'none' }
  | { status: 'ambiguous'; banks: StatementBank[] };

/** A bank is only a candidate when its identity text and its transaction-table
 * header both appear; either signal alone is too weak to auto-select. Banks
 * come back in STATEMENT_BANKS order so callers can list them stably. */
export function detectStatementBank(lines: StatementLine[]): BankDetection {
  const text = lines.map((line) => line.text).join('\n');
  const candidates = STATEMENT_BANKS.map((entry) => entry.value).filter(
    (bank) =>
      matchesStatementIdentity(bank, text) &&
      (getStatementLayout(bank)?.detect(lines).size ?? 0) > 0
  );
  const banks = candidates.filter(
    (bank) =>
      !LAYOUT_PRECEDENCE.some(
        (pair) => pair.loser === bank && candidates.includes(pair.winner)
      )
  );
  if (banks.length === 0) return { status: 'none' };
  if (banks.length === 1) return { status: 'match', bank: banks[0] };
  return { status: 'ambiguous', banks };
}
