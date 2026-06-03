import { format } from 'date-fns';
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES } from '../constants';
import type { ExpenseType } from '../types';

// Try to parse a date string into yyyy-MM-dd.
export function tryParseDate(s: string): string | null {
  // yyyy-MM-dd
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  }
  // dd/MM/yyyy or MM/dd/yyyy — try both, prefer dd/MM (SG convention)
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    const ddmm = new Date(`${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`);
    if (!isNaN(ddmm.getTime())) return format(ddmm, 'yyyy-MM-dd');
    const mmdd = new Date(`${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`);
    if (!isNaN(mmdd.getTime())) return format(mmdd, 'yyyy-MM-dd');
  }
  // "7 Apr 2026" or "Apr 7, 2026"
  const d = new Date(s);
  if (!isNaN(d.getTime()) && s.length > 4) return format(d, 'yyyy-MM-dd');
  return null;
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

export interface ParsedRow {
  date?: string;
  type?: ExpenseType;
  item?: string;
  info?: string;
  amount?: string;
}

// Parse a tab-separated Excel row into form fields.
// Columns are matched by content heuristics so column order doesn't matter.
export function parsePastedRow(text: string): ParsedRow {
  const cols = text
    .trim()
    .split('\t')
    .map((c) => c.trim())
    .filter(Boolean);

  const result: ParsedRow = {};
  const unmatched: string[] = [];

  for (const col of cols) {
    // Skip header-like values
    if (/^(date|type|category|item|brand|info|desc|amount|sgd)$/i.test(col))
      continue;

    if (!result.date) {
      const d = tryParseDate(col);
      if (d) {
        result.date = d;
        continue;
      }
    }

    if (!result.type) {
      const t = tryParseCategory(col);
      if (t) {
        result.type = t;
        continue;
      }
    }

    if (!result.amount) {
      const num = parseFloat(col.replace(/[$,\s]/g, ''));
      if (!isNaN(num) && num > 0 && /^[\d$,.]+$/.test(col.replace(/\s/g, ''))) {
        result.amount = String(num);
        continue;
      }
    }

    unmatched.push(col);
  }

  if (unmatched[0]) result.item = unmatched[0];
  if (unmatched[1]) result.info = unmatched[1];

  return result;
}
