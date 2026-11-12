import type { StatementLine } from '../../types';
import { columnHeaderStatementDate } from '../statement-dates';
import type { StatementLayout } from './types';

const HEADER = /\bDATE\s+DESCRIPTION\s+AMOUNT\s*\(S\$\)/i;
// Card rows carry no year. A trailing year marks the page-1 summary line, and
// the payment slip is bare digits, so neither may start a row.
const ROW_START =
  /^\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b(?!\s+(?:19|20)\d{2}\b)\s+\S/i;
const SUMMARY_HEADER = /^STATEMENT DATE\b.*\bCREDIT LIMIT\b/i;
const REFERENCE = /^REF NO\s*:/i;
const BOUNDARY =
  /^(?:SUB-TOTAL|TOTAL|GRAND TOTAL|STATEMENT PRINTED ON|PREVIOUS BALANCE|NEW TRANSACTIONS|DBS .*CARD NO)\b/i;

export const dbsLayout: StatementLayout = {
  detect(lines) {
    return lines.some((line) => HEADER.test(line.text))
      ? new Set(lines.map((line) => line.page))
      : new Set();
  },
  groupRows(lines, claimedPages) {
    const groups: StatementLine[][] = [];
    let current: StatementLine[] | undefined;
    let inTable = false;
    let skipNext = false;
    for (const line of lines) {
      if (!claimedPages.has(line.page)) continue;
      const text = line.text.trim();
      if (HEADER.test(text)) {
        inTable = true;
        current = undefined;
        continue;
      }
      if (!inTable) continue;
      if (skipNext) {
        skipNext = false;
        continue;
      }
      if (SUMMARY_HEADER.test(text)) {
        skipNext = true;
        current = undefined;
      } else if (BOUNDARY.test(text)) current = undefined;
      else if (ROW_START.test(text)) {
        current = [line];
        groups.push(current);
      } else if (current && REFERENCE.test(text)) current.push(line);
    }
    return groups;
  },
  // The first value column is the statement date; the last is the payment due
  // date, and the footer print date is never under this label line.
  period: (lines) => columnHeaderStatementDate(lines, SUMMARY_HEADER),
  columns: { billedSgd: true, twoDate: false },
};
