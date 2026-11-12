import type { StatementLine } from '../../types';
import {
  agreedPeriod,
  findDates,
  flatText,
  statementDatePeriod,
  type DetectedStatementPeriod,
} from '../statement-dates';
import type { StatementLayout } from './types';

const HEADER = /\bDATE\s+DESCRIPTION\s+AMOUNT\s*\(SGD\)/i;
const ROW_START =
  /^\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b(?!\s+(?:19|20)\d{2}\b)\s+\S/i;
const SECTION = /^TRANSACTIONS FOR\b/i;
const FOOTER = /^(?:SUB-TOTAL|GRAND TOTAL)\b/i;
const BALANCE = /^BALANCE PREVIOUS STATEMENT\b/i;
const FOREIGN = /^FOREIGN AMOUNT\b/i;
// The 16-digit reference sits right of the amount column and would otherwise
// be read as the amount.
const TRAILING_REFERENCE = /\s+\d{16}\s*$/;
// The SGD trailer repeats the billed value plus a fee column; the real amount
// is the last token, so the trailer is dropped only when one follows it.
const SGD_TRAILER =
  /\s+SGD\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}(?=\s+\(?[\d,]+\.\d{2}\)?\s*$)/i;

function cleaned(line: StatementLine): StatementLine {
  const text = line.text
    .trim()
    .replace(TRAILING_REFERENCE, '')
    .replace(SGD_TRAILER, '');
  return text === line.text ? line : { ...line, text };
}

// The text layer can put left-column text before the label, so the label is
// found anywhere on the line. A payment due date never matches this label.
const STATEMENT_DATE = /(?<![A-Za-z])Statement\s+Date\s*:?\s*(.*)$/i;
const OTHER_STATEMENT = /\b(?:previous|prior|last|next)\s+$/i;

function statementDate(lines: StatementLine[]): DetectedStatementPeriod | null {
  const results: DetectedStatementPeriod[] = [];
  for (const line of lines) {
    const text = flatText(line.text);
    const match = STATEMENT_DATE.exec(text);
    if (!match || OTHER_STATEMENT.test(text.slice(0, match.index))) continue;
    const dates = findDates(match[1]);
    if (dates.length === 1 && dates[0].index === 0)
      results.push(statementDatePeriod(dates[0].iso));
  }
  return agreedPeriod(results);
}

export const citiLayout: StatementLayout = {
  period: statementDate,
  detect(lines) {
    return lines.some((line) => HEADER.test(line.text))
      ? new Set(lines.map((line) => line.page))
      : new Set();
  },
  groupRows(lines, claimedPages) {
    const groups: StatementLine[][] = [];
    let inTable = false;
    for (const line of lines) {
      if (!claimedPages.has(line.page)) continue;
      const text = line.text.trim();
      if (HEADER.test(text) || SECTION.test(text)) inTable = true;
      else if (/^GRAND TOTAL\b/i.test(text)) inTable = false;
      if (!inTable || FOOTER.test(text) || BALANCE.test(text)) continue;
      if (FOREIGN.test(text)) continue;
      if (ROW_START.test(text)) groups.push([cleaned(line)]);
    }
    return groups;
  },
  columns: { billedSgd: true, twoDate: false },
};
