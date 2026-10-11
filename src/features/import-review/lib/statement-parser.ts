import { z } from 'zod';
import {
  STATEMENT_BANKS,
  STATEMENT_LIMITS,
  STATEMENT_MONTHS,
} from '../constants';
import type {
  PositionedStatementText,
  StatementBank,
  StatementCandidate,
  StatementLine,
  StatementPeriod,
} from '../types';

const calendar = z.iso.date();
const DATE_PREFIX =
  /^(\d{1,2})(?:[ /-](\d{1,2})|\s+([A-Za-z]{3,9}))(?:[ /-](\d{4}))?\s+/;
const MONEY =
  /(?:SGD|S\$|USD|US\$|\$)?\s*[+-]?\(?\d[\d,.]*\.\d+\)?(?:\s*(?:CR|DR))?/gi;

export function positionedStatementLines(
  items: PositionedStatementText[],
  page: number
): StatementLine[] {
  if (items.length > STATEMENT_LIMITS.textItems)
    throw new Error('Statement text limit');
  const ordered = items
    .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: { y: number; items: PositionedStatementText[] }[] = [];
  for (const item of ordered) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - item.y) <= 2) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.map((line, index) => ({
    page,
    line: index + 1,
    text: line.items
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(' ')
      .trim(),
  }));
}

export function validStatementPeriod(period: StatementPeriod): boolean {
  if (
    !calendar.safeParse(period.from).success ||
    !calendar.safeParse(period.to).success
  )
    return false;
  const span = Date.parse(period.to) - Date.parse(period.from);
  return span >= 0 && span <= 400 * 86400000;
}

function statementDate(
  match: RegExpMatchArray,
  period: StatementPeriod
): string {
  const day = match[1].padStart(2, '0');
  const monthNumber = match[2]
    ? Number(match[2])
    : STATEMENT_MONTHS.indexOf(
        match[3]?.toLowerCase().slice(0, 3) as (typeof STATEMENT_MONTHS)[number]
      ) + 1;
  const month = String(monthNumber).padStart(2, '0');
  const years = match[4]
    ? [match[4]]
    : [...new Set([period.from.slice(0, 4), period.to.slice(0, 4)])];
  const dates = years
    .map((year) => `${year}-${month}-${day}`)
    .filter(
      (date) =>
        calendar.safeParse(date).success &&
        date >= period.from &&
        date <= period.to
    );
  return dates.length === 1 ? dates[0] : '';
}

function qualifyRow(
  source: StatementLine[],
  period: StatementPeriod,
  billedSgd: boolean
): StatementCandidate {
  const raw = source.map((line) => line.text).join(' ');
  const match = raw.match(DATE_PREFIX);
  const date = match ? statementDate(match, period) : '';
  const body = match ? raw.slice(match[0].length).trim() : raw;
  const values = [...body.matchAll(MONEY)];
  const explicitSgd = values.filter((value) => /SGD|S\$/i.test(value[0]));
  const chosen =
    explicitSgd.length === 1
      ? explicitSgd[0]
      : explicitSgd.length === 0 &&
          billedSgd &&
          values.length === 1 &&
          !/USD|US\$/i.test(values[0][0])
        ? values[0]
        : undefined;
  const amountText = chosen?.[0] ?? '';
  const normalized = amountText.replace(/^(SGD|S\$|\$)\s*/i, '').trim();
  const positiveMoney = /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)\.\d{2}$/.test(
    normalized
  );
  const amount =
    positiveMoney &&
    Number(normalized.replaceAll(',', '')) > 0 &&
    Number.isSafeInteger(
      Math.round(Number(normalized.replaceAll(',', '')) * 100)
    )
      ? normalized.replaceAll(',', '')
      : '';
  const descriptionEnd = values[0]?.index ?? body.length;
  const description = body
    .slice(0, descriptionEnd)
    .replace(/[|]+/g, ' ')
    .trim();
  const row: StatementCandidate = {
    id: `${source[0].page}:${source[0].line}`,
    source,
    date,
    description,
    amount,
    category: 'other',
    status: 'candidate',
    issues: [],
  };
  if (
    /\b(?:OPENING BALANCE|CLOSING BALANCE|TOTAL BALANCE|AMOUNT DUE|MINIMUM PAYMENT)\b/i.test(
      description
    )
  ) {
    row.status = 'excluded';
    row.amount = '';
    row.issues.push('Statement summary: not a transaction.');
  } else if (
    /\b(?:CR|REFUND|REVERSAL|CREDIT|DIVIDEND)\b/i.test(body) ||
    values.some((value) => /[-()]/.test(value[0]))
  ) {
    row.status = 'excluded';
    row.amount = '';
    row.issues.push('Credit or refund: not a positive expense.');
  } else if (
    /\b(?:TRANSFER|REPAYMENT|PAYMENT RECEIVED|CARD PAYMENT|PAYMENT THANK YOU)\b/i.test(
      description
    )
  ) {
    row.status = 'excluded';
    row.issues.push('Transfer or repayment: excluded from expenses.');
  } else {
    if (
      values.length > 1 &&
      values.some((value) => value !== chosen && !/USD|US\$/i.test(value[0]))
    )
      row.issues.push(
        'Multiple amount columns are ambiguous; compare the original statement.'
      );
    if (!date)
      row.issues.push(
        'Date is invalid, ambiguous or outside the supplied period.'
      );
    if (!amount)
      row.issues.push(
        'A valid positive SGD billed amount is required; no exchange rate is assumed.'
      );
    if (!description) row.issues.push('Description is missing.');
    if (row.issues.length) row.status = 'unresolved';
  }
  return row;
}

/** Conservative text-layout review; no row is saved and unsupported layouts fail
 * visibly. Only the declared synthetic date/description/billed-SGD variants are
 * qualified by fixtures; bank selection alone never establishes layout support. */
export function parseStatementLines(
  lines: StatementLine[],
  bank: StatementBank,
  period: StatementPeriod
): StatementCandidate[] {
  if (!validStatementPeriod(period))
    throw new Error('Enter a valid statement period of at most 400 days.');
  if (
    lines.reduce((sum, line) => sum + line.text.length, 0) >
    STATEMENT_LIMITS.characters
  )
    throw new Error('Statement text limit');
  const text = lines.map((line) => line.text).join('\n');
  const identity = STATEMENT_BANKS.find((entry) => entry.value === bank);
  if (!identity?.identity.test(text))
    throw new Error(
      'The selected bank could not be identified in this text PDF.'
    );
  const billedSgd =
    /(?:SGD|S\$)\s*(?:BILLED|AMOUNT)|(?:BILLED|AMOUNT)\s*(?:SGD|S\$)|SGD\s+BILLED/i.test(
      text
    );
  const groups: StatementLine[][] = [];
  for (const line of lines) {
    if (
      /^(?:OPENING BALANCE|CLOSING BALANCE|TOTAL BALANCE|TOTAL\b|TRANSACTION DATE|STATEMENT PERIOD|DESCRIPTION\b|SYNTHETIC\b)/i.test(
        line.text
      ) &&
      !DATE_PREFIX.test(line.text)
    )
      continue;
    if (DATE_PREFIX.test(line.text)) groups.push([line]);
    else {
      const preceding = groups.at(-1);
      if (
        preceding &&
        preceding[0].page === line.page &&
        !MONEY.test(preceding.map((item) => item.text).join(' ')) &&
        line.text.trim()
      )
        preceding.push(line);
      MONEY.lastIndex = 0;
    }
  }
  const rows = groups.map((source) => qualifyRow(source, period, billedSgd));
  if (!rows.length)
    throw new Error(
      'No supported transaction rows were found. Image-only and other layouts require manual review.'
    );
  const seen = new Map<string, StatementCandidate>();
  for (const row of rows) {
    if (row.status !== 'candidate') continue;
    const key = JSON.stringify([
      row.date,
      row.amount,
      row.description.toLowerCase().replace(/\s+/g, ' '),
    ]);
    const duplicate = seen.get(key);
    if (duplicate) {
      for (const entry of [duplicate, row]) {
        entry.status = 'unresolved';
        if (
          !entry.issues.includes('Possible duplicate: compare the source rows.')
        )
          entry.issues.push('Possible duplicate: compare the source rows.');
      }
    } else seen.set(key, row);
  }
  return rows;
}
