import { z } from 'zod';
import type { StatementLine, StatementPeriod } from '../types';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
export const DATE_TEXT = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})`;
const calendar = z.iso.date();

export interface DetectedStatementPeriod {
  period: StatementPeriod;
  basis: 'printed-period' | 'statement-date' | 'statement-month';
}

export function monthNumber(text: string): number {
  const name = text.toLowerCase();
  // Some issuers print September as four letters.
  if (name === 'sept') return 9;
  return (
    MONTHS.findIndex((month) => month === name || month.slice(0, 3) === name) +
    1
  );
}

export function isoDate(text: string): string | null {
  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const named = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const american = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  let value = text;
  const parts = numeric
    ? { day: numeric[1], month: Number(numeric[2]), year: numeric[3] }
    : named
      ? { day: named[1], month: monthNumber(named[2]), year: named[3] }
      : american
        ? {
            day: american[2],
            month: monthNumber(american[1]),
            year: american[3],
          }
        : null;
  if (parts)
    value = `${parts.year}-${String(parts.month).padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
  return calendar.safeParse(value).success ? value : null;
}

/** Every date-shaped token in the text, in order. Tokens that are not real
 * calendar dates are skipped. */
export function findDates(text: string): { iso: string; index: number }[] {
  const found: { iso: string; index: number }[] = [];
  for (const match of text.matchAll(new RegExp(DATE_TEXT, 'g'))) {
    const iso = isoDate(match[0]);
    if (iso) found.push({ iso, index: match.index });
  }
  return found;
}

export function previousMonthStart(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${String(month === 1 ? year - 1 : year).padStart(4, '0')}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}-01`;
}

export function statementDatePeriod(date: string): DetectedStatementPeriod {
  return {
    period: { from: previousMonthStart(date), to: date },
    basis: 'statement-date',
  };
}

export function flatText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The single result every header agrees on; disagreement returns null so a
 * conflict never silently picks one date. */
export function agreedPeriod(
  results: DetectedStatementPeriod[]
): DetectedStatementPeriod | null {
  const first = results[0];
  if (!first) return null;
  return results.every(
    (result) =>
      result.basis === first.basis &&
      result.period.from === first.period.from &&
      result.period.to === first.period.to
  )
    ? first
    : null;
}

/** Multi-column header: a label line, then a value line whose first column is
 * the statement date. Later dates on the value line (payment due) are never
 * read. */
export function columnHeaderStatementDate(
  lines: StatementLine[],
  label: RegExp
): DetectedStatementPeriod | null {
  const results: DetectedStatementPeriod[] = [];
  for (const [index, line] of lines.entries()) {
    if (!label.test(flatText(line.text))) continue;
    const next = lines[index + 1];
    if (next?.page !== line.page) continue;
    const first = findDates(flatText(next.text))[0];
    if (first?.index === 0) results.push(statementDatePeriod(first.iso));
  }
  return agreedPeriod(results);
}
