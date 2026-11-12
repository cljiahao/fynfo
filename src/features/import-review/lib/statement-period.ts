import type { StatementBank, StatementLine, StatementPeriod } from '../types';
import {
  DATE_TEXT,
  findDates,
  flatText,
  isoDate,
  monthNumber,
  previousMonthStart,
  statementDatePeriod,
  type DetectedStatementPeriod,
} from './statement-dates';
import { getStatementLayout } from './statement-layouts';
import { validStatementPeriod } from './statement-parser';

export type { DetectedStatementPeriod };

const RANGE = new RegExp(
  `(${DATE_TEXT})\\s*(?:to|until|–|-)\\s*(${DATE_TEXT})`,
  'gi'
);

/** The range in the text, or null when it is not exactly one range. A range
 * that fails the calendar is not a date and is ignored by the caller. */
function readRange(text: string): StatementPeriod | null {
  const matches = [...text.matchAll(RANGE)];
  if (matches.length !== 1) return null;
  const from = isoDate(matches[0][1]);
  const to = isoDate(matches[0][2]);
  return from && to ? { from, to } : null;
}

function readMonth(text: string): string | null {
  const match = text.match(/(?:^|\s)([A-Za-z]{3,9})\s+(\d{4})$/);
  const month = match && monthNumber(match[1]);
  return match && month
    ? `${match[2]}-${String(month).padStart(2, '0')}`
    : null;
}

/** A value read as one date: the whole text, else the only date in it. */
function readDate(text: string): string | null {
  const exact = isoDate(text);
  if (exact) return exact;
  const found = findDates(text);
  return found.length === 1 ? found[0].iso : null;
}

/** Only labelled, full-year headers qualify. The anchor window is intentionally
 * bounded to this and the preceding month; unsupported older dates stay blocked.
 * A labelled value that is not a date is ignored; two readable values that
 * disagree return null. */
function detectLabelled(
  lines: StatementLine[]
): DetectedStatementPeriod | null {
  const ranges: StatementPeriod[] = [];
  const dates: string[] = [];
  const months: string[] = [];
  let invalid = false;
  for (const [index, line] of lines.entries()) {
    const text = flatText(line.text);
    const label = text.match(
      /^(Statement Period|Statement Date|Date of Statement|Statement Month|Statement For)\s*:?\s*(.*)$/i
    );
    if (!label) continue;
    const next = lines[index + 1];
    // A label followed by other column labels takes no value from the next
    // line: that row may hold a payment due date.
    const value =
      label[2] || (next?.page === line.page ? flatText(next.text) : '');
    if (/period/i.test(label[1])) {
      const range = readRange(value);
      if (!range) continue;
      if (!validStatementPeriod(range)) invalid = true;
      else ranges.push(range);
    } else if (/date/i.test(label[1])) {
      const date = readDate(value);
      if (date) dates.push(date);
    } else {
      const month = readMonth(value);
      if (month) months.push(month);
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
    const period = statementDatePeriod(date);
    return validStatementPeriod(period.period) ? period : null;
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

/** The bank's own header reader runs first when the bank is known; when it has
 * none, or finds nothing it can vouch for, the generic labelled detector runs. */
export function detectStatementPeriod(
  lines: StatementLine[],
  bank?: StatementBank
): DetectedStatementPeriod | null {
  const fromLayout = bank ? getStatementLayout(bank)?.period?.(lines) : null;
  if (fromLayout && validStatementPeriod(fromLayout.period)) return fromLayout;
  return detectLabelled(lines);
}
