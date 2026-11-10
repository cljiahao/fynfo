import type { StatementLine } from '../../types';
import type { StatementLayout } from './types';

// The account summary sits beside the transaction table and OCR merges both
// into one line, so words at or beyond this x (PDF points) are never row data.
const TABLE_MAX_X = 385;
// Amounts are right-aligned and start near x 333; the band is wide because OCR
// x values drift by a point or two.
const AMOUNT_MIN_X = 300;

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)' as const;
const DAY_MONTH = new RegExp(`^(\\d{1,2})(${MONTH})$`, 'i');
const MONTH_WORD = new RegExp(`^${MONTH}$`, 'i');
const DAY_WORD = /^\d{1,2}$/;
const AMOUNT_WORD = /^(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/;
const AMOUNT_WITH_CREDIT = /^((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(CR)?$/i;
const HEADER = /\bDATE\s+DATE\s+DESCRIPTION\s+AMOUNT\s*\(SGD\)/i;
const TOTAL_DUE =
  /^Total\s+Due\s+((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s*(CR)?$/i;

interface Token {
  text: string;
  x?: number;
  confidence?: number;
}

/** Table-column tokens of one line: right-column words, divider glyphs and
 * glued `07Sep` dates are resolved here so row matching sees clean tokens. */
function tableTokens(line: StatementLine): Token[] {
  const words: Token[] =
    line.words ??
    line.text
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text }));
  return words
    .filter((word) => word.x === undefined || word.x < TABLE_MAX_X)
    .flatMap((word): Token[] => {
      const glued = word.text.match(DAY_MONTH);
      return glued
        ? [
            { ...word, text: glued[1] },
            { ...word, text: glued[2] },
          ]
        : [word];
    })
    .filter((word) => /[A-Za-z0-9]/.test(word.text));
}

function minConfidence(tokens: Token[]): number | undefined {
  const values = tokens.flatMap((token) =>
    typeof token.confidence === 'number' ? [token.confidence] : []
  );
  return values.length ? Math.min(...values) : undefined;
}

function tableText(line: StatementLine): string {
  return tableTokens(line)
    .map((token) => token.text)
    .join(' ');
}

/** `1,234.56`, `1,234.56CR` or `1,234.56 CR` at the end of the tokens. */
function trailingAmount(
  tokens: Token[]
): { count: number; amount: string; credit: boolean } | undefined {
  const inColumn = (token?: Token) =>
    token !== undefined && (token.x === undefined || token.x >= AMOUNT_MIN_X);
  const last = tokens.at(-1);
  const before = tokens.at(-2);
  if (last && /^CR$/i.test(last.text))
    return before && inColumn(before) && AMOUNT_WORD.test(before.text)
      ? { count: 2, amount: before.text, credit: true }
      : undefined;
  const match = inColumn(last) ? last?.text.match(AMOUNT_WITH_CREDIT) : null;
  return match
    ? { count: 1, amount: match[1], credit: Boolean(match[2]) }
    : undefined;
}

function parseRow(line: StatementLine): StatementLine | undefined {
  const tokens = tableTokens(line);
  const [postDay, postMonth, tranDay, tranMonth] = tokens;
  if (
    tokens.length < 5 ||
    !DAY_WORD.test(postDay.text) ||
    !MONTH_WORD.test(postMonth.text) ||
    !DAY_WORD.test(tranDay.text) ||
    !MONTH_WORD.test(tranMonth.text)
  )
    return undefined;
  const trailing = trailingAmount(tokens.slice(4));
  if (!trailing) return undefined;
  const description = tokens
    .slice(4, tokens.length - trailing.count)
    .map((token) => token.text)
    .join(' ');
  const confidence = minConfidence(tokens);
  const { words: _words, confidence: _confidence, ...rest } = line;
  // Both dates stay in the text (the parser takes the second as the row date);
  // the CR suffix is split off because credit detection needs a word boundary.
  return {
    ...rest,
    text: [
      postDay.text,
      postMonth.text,
      tranDay.text,
      tranMonth.text,
      description,
      trailing.amount,
      ...(trailing.credit ? ['CR'] : []),
    ]
      .filter(Boolean)
      .join(' '),
    ...(confidence !== undefined ? { confidence } : {}),
  };
}

function scan(
  lines: StatementLine[],
  claimedPages: ReadonlySet<number>
): { rows: StatementLine[][]; totalCents?: number } {
  const rows: StatementLine[][] = [];
  let totalCents: number | undefined;
  let inTable = false;
  let page = 0;
  for (const line of lines) {
    if (!claimedPages.has(line.page)) continue;
    if (line.page !== page) {
      page = line.page;
      inTable = false;
    }
    const text = tableText(line);
    if (HEADER.test(text)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const total = text.match(TOTAL_DUE);
    if (total) {
      totalCents =
        Math.round(Number(total[1].replaceAll(',', '')) * 100) *
        (total[2] ? -1 : 1);
      inTable = false;
      continue;
    }
    const row = parseRow(line);
    // Continuation lines (often a country code) and non-row lines are dropped:
    // the description and amount sit on the first line.
    if (row) rows.push([row]);
  }
  return { rows, totalCents };
}

export const hsbcLayout: StatementLayout = {
  detect(lines) {
    return lines.some((line) => HEADER.test(tableText(line)))
      ? new Set(lines.map((line) => line.page))
      : new Set();
  },
  groupRows(lines, claimedPages) {
    return scan(lines, claimedPages).rows;
  },
  blockTotals(lines, claimedPages) {
    const { rows, totalCents } = scan(lines, claimedPages);
    return totalCents === undefined
      ? []
      : [{ totalCents, rowStarts: rows.map((group) => group[0]) }];
  },
  columns: { billedSgd: true, twoDate: true },
};
