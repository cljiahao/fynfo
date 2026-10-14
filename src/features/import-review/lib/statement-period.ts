import { z } from 'zod';
import type { StatementLine, StatementPeriod } from '../types';
import { validStatementPeriod } from './statement-parser';

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
const DATE_TEXT = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})`;
const calendar = z.iso.date();

function monthNumber(text: string): number {
  return (
    MONTHS.findIndex(
      (month) =>
        month === text.toLowerCase() || month.slice(0, 3) === text.toLowerCase()
    ) + 1
  );
}
function isoDate(text: string): string | null {
  let value = text;
  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const named = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (numeric || named) {
    const match = (numeric ?? named)!;
    const month = numeric ? Number(match[2]) : monthNumber(match[2]);
    value = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return calendar.safeParse(value).success ? value : null;
}
function previousMonthStart(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${String(month === 1 ? year - 1 : year).padStart(4, '0')}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}-01`;
}

export interface DetectedStatementPeriod {
  period: StatementPeriod;
  basis: 'printed-period' | 'statement-date' | 'statement-month';
}

/** Only labelled, full-year headers qualify. The anchor window is intentionally
 * bounded to this and the preceding month; unsupported older dates stay blocked. */
export function detectStatementPeriod(
  lines: StatementLine[]
): DetectedStatementPeriod | null {
  const ranges: StatementPeriod[] = [];
  const dates: string[] = [];
  const months: string[] = [];
  let invalid = false;
  for (const [index, line] of lines.entries()) {
    const text = line.text.replace(/\s+/g, ' ').trim();
    const label = text.match(
      /^(Statement Period|Statement Date|Date of Statement|Statement Month|Statement For)\s*:?\s*(.*)$/i
    );
    if (!label) continue;
    const next = lines[index + 1];
    const value = (label[2] || (next?.page === line.page ? next.text : ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (/period/i.test(label[1])) {
      const match = value.match(
        new RegExp(
          `^(${DATE_TEXT})\\s*(?:to|until|–|-)\\s*(${DATE_TEXT})$`,
          'i'
        )
      );
      const from = match && isoDate(match[1]);
      const to = match && isoDate(match[2]);
      if (!from || !to || !validStatementPeriod({ from, to })) invalid = true;
      else ranges.push({ from, to });
    } else if (/date/i.test(label[1])) {
      const date = isoDate(value);
      if (!date) invalid = true;
      else dates.push(date);
    } else {
      const match = value.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
      const month = match && monthNumber(match[1]);
      const first =
        match && month
          ? `${match[2]}-${String(month).padStart(2, '0')}-01`
          : null;
      if (!first || !calendar.safeParse(first).success) invalid = true;
      else months.push(first.slice(0, 7));
    }
  }
  const uniqueRanges = [
    ...new Map(ranges.map((range) => [JSON.stringify(range), range])).values(),
  ];
  const uniqueDates = [...new Set(dates)];
  const uniqueMonths = [...new Set(months)];
  if (
    invalid ||
    uniqueRanges.length > 1 ||
    uniqueDates.length > 1 ||
    uniqueMonths.length > 1
  )
    return null;
  const range = uniqueRanges[0];
  const date = uniqueDates[0];
  const month = uniqueMonths[0];
  if (date && month && date.slice(0, 7) !== month) return null;
  if (range) {
    if (date && range.to !== date) return null;
    if (month && range.to.slice(0, 7) !== month) return null;
    return { period: range, basis: 'printed-period' };
  }
  if (date) {
    const period = { from: previousMonthStart(date), to: date };
    return validStatementPeriod(period)
      ? { period, basis: 'statement-date' }
      : null;
  }
  if (month) {
    const first = `${month}-01`;
    const end = new Date(`${first}T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const period = {
      from: previousMonthStart(first),
      to: end.toISOString().slice(0, 10),
    };
    return validStatementPeriod(period)
      ? { period, basis: 'statement-month' }
      : null;
  }
  return null;
}
