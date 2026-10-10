import { z } from 'zod';
import {
  EXPENSE_PASTE_CREDIT,
  EXPENSE_PASTE_ISO_DATE,
  EXPENSE_PASTE_MONEY,
  EXPENSE_PASTE_MONEY_CANDIDATE,
  EXPENSE_PASTE_MONTH_ALIASES,
  EXPENSE_PASTE_MONTHS,
  EXPENSE_PASTE_NAMED_DATE,
  EXPENSE_PASTE_NONDECIMAL_MONEY,
  EXPENSE_PASTE_SLASH_DATE,
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPES,
} from '../constants';
import type { ExpenseType } from '../types';

const CALENDAR_DATE = z.iso.date();

function dateParts(s: string): [string, string, string] | null {
  const iso = s.match(EXPENSE_PASTE_ISO_DATE);
  if (iso) return [iso[1], iso[2], iso[3]];
  const slash = s.match(EXPENSE_PASTE_SLASH_DATE);
  if (slash) {
    const [, first, second, year] = slash;
    // Ambiguous dates stay day/month; only an impossible month permits US order.
    return Number(second) > 12 && Number(first) >= 1 && Number(first) <= 12
      ? [year, first, second]
      : [year, second, first];
  }
  const named = s.match(EXPENSE_PASTE_NAMED_DATE);
  if (!named) return null;
  const name = (named[1] ?? named[5]).toLowerCase();
  const month = Object.hasOwn(EXPENSE_PASTE_MONTH_ALIASES, name)
    ? EXPENSE_PASTE_MONTH_ALIASES[name] - 1
    : EXPENSE_PASTE_MONTHS.findIndex(
        (value) => value === name || value.slice(0, 3) === name
      );
  if (month < 0) return null;
  return [named[3] ?? named[6], String(month + 1), named[2] ?? named[4]];
}

export function tryParseDate(s: string): string | null {
  const parts = dateParts(s);
  if (!parts) return null;
  const [year, month, day] = parts;
  const canonical = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return CALENDAR_DATE.safeParse(canonical).success ? canonical : null;
}
// Try to match a string to an ExpenseType.
export function tryParseCategory(s: string): ExpenseType | null {
  const lower = s.toLowerCase().replace(/[^a-z]/g, '');
  // Exact key match (food_drink → fooddrink)
  for (const t of EXPENSE_TYPES) {
    if (t.replace('_', '') === lower) return t;
  }
  // Label match
  for (const t of EXPENSE_TYPES) {
    if (EXPENSE_TYPE_LABELS[t].toLowerCase().replace(/[^a-z]/g, '') === lower)
      return t;
  }
  // Starts-with match
  for (const t of EXPENSE_TYPES) {
    if (
      EXPENSE_TYPE_LABELS[t].toLowerCase().startsWith(s.toLowerCase()) &&
      s.length >= 2
    )
      return t;
  }
  return null;
}

export type PasteIssue =
  | { field: 'date'; code: 'INVALID_DATE' }
  | { field: 'amount'; code: 'INVALID_AMOUNT' | 'UNSUPPORTED_CREDIT' };

export interface ParsedRow {
  date?: string;
  type?: ExpenseType;
  item?: string;
  info?: string;
  amount?: string;
  issues?: PasteIssue[];
}

// Match spreadsheet columns by content without interpreting arbitrary text as dates.
export function parsePastedRow(text: string): ParsedRow {
  const cols = text
    .trim()
    .split('\t')
    .map((c) => c.trim())
    .filter(Boolean);
  const result: ParsedRow = {};
  const unmatched: string[] = [];
  const issue = (value: PasteIssue) => {
    (result.issues ??= []).push(value);
  };
  for (const col of cols) {
    if (/^(date|type|category|item|brand|info|desc|amount|sgd)$/i.test(col))
      continue;
    if (dateParts(col)) {
      const date = tryParseDate(col);
      if (!date) issue({ field: 'date', code: 'INVALID_DATE' });
      else if (!result.date) result.date = date;
      else unmatched.push(col);
      continue;
    }
    const credit =
      EXPENSE_PASTE_CREDIT.test(col) ||
      (EXPENSE_PASTE_MONEY_CANDIDATE.test(col) && /[-()]/.test(col));
    if (credit) {
      issue({ field: 'amount', code: 'UNSUPPORTED_CREDIT' });
      continue;
    }
    if (
      EXPENSE_PASTE_MONEY_CANDIDATE.test(col) ||
      col.startsWith('$') ||
      EXPENSE_PASTE_NONDECIMAL_MONEY.test(col)
    ) {
      const value = Number(col.replace(/[$,]/g, '').trim());
      if (
        !EXPENSE_PASTE_MONEY.test(col) ||
        !Number.isFinite(value) ||
        value <= 0
      ) {
        issue({ field: 'amount', code: 'INVALID_AMOUNT' });
      } else if (!result.amount) result.amount = String(value);
      else unmatched.push(col);
      continue;
    }
    if (!result.type) {
      const type = tryParseCategory(col);
      if (type) {
        result.type = type;
        continue;
      }
    }
    unmatched.push(col);
  }
  if (unmatched[0]) result.item = unmatched[0];
  if (unmatched[1]) result.info = unmatched[1];
  return result;
}
