import type { StatementLine } from '../../types';
import { columnHeaderStatementDate } from '../statement-dates';
import type { StatementLayout } from './types';

const HEADER = /^DATE\s+DESCRIPTION\s+AMOUNT$/i;
const SECTION_START = /^PayLah!\s+Wallet\b/i;
// The statement-date line under the page-1 summary header begins `DD Mon YYYY`,
// so a trailing year must never start a row.
const ROW_START =
  /^\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b(?!\s+(?:19|20)\d{2}\b)\s+\S/i;
const BOUNDARY = /^(?:PREVIOUS BALANCE|Total Balance Carried Forward)\b/i;

const SUMMARY_HEADER = /^STATEMENT DATE\b.*\bMOBILE NUMBER\b/i;

export const paylahLayout: StatementLayout = {
  period: (lines) => columnHeaderStatementDate(lines, SUMMARY_HEADER),
  detect(lines) {
    return lines.some((line) => HEADER.test(line.text.trim()))
      ? new Set(lines.map((line) => line.page))
      : new Set();
  },
  groupRows(lines, claimedPages) {
    const groups: StatementLine[][] = [];
    let inTable = false;
    for (const line of lines) {
      if (!claimedPages.has(line.page)) continue;
      const text = line.text.trim();
      if (HEADER.test(text) || SECTION_START.test(text)) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;
      if (BOUNDARY.test(text)) continue;
      // Each row's `Ref No.:` line is dropped so reference codes never reach the
      // description or amount detection.
      if (ROW_START.test(text)) groups.push([line]);
    }
    return groups;
  },
  columns: { billedSgd: true, twoDate: false },
};
