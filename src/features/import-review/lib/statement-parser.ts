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
  StatementClassification,
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

function positiveStatementAmount(value: string): boolean {
  return (
    /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)\.\d{2}$/.test(value) &&
    Number(value.replaceAll(',', '')) > 0 &&
    Number.isSafeInteger(Math.round(Number(value.replaceAll(',', '')) * 100))
  );
}

function suggestClassification(
  sourceText: string,
  values: RegExpMatchArray[],
  hasPositiveAmount: boolean
): { kind: StatementClassification; reason: string; blocker?: string } {
  const refund = /\bREFUND\b/i.test(sourceText);
  const transfer = /\bTRANSFER\b/i.test(sourceText);
  const repayment =
    /\b(?:CARD (?:PAYMENT|REPAYMENT)|PAYMENT THANK YOU|PAYMT THRU)\b/i.test(
      sourceText
    );
  const credit =
    /\b(?:CR|CREDIT|DIVIDEND)\b/i.test(sourceText) ||
    values.some((value) => /\bCR\b|[-()]/i.test(value[0]));
  const debit = values.some((value) => /\bDR\b/i.test(value[0]));
  if (
    Number(refund) + Number(transfer) + Number(repayment) > 1 ||
    (credit && debit)
  ) {
    return {
      kind: 'unknown',
      reason: 'The source contains conflicting transaction signals.',
      blocker:
        'Conflicting source signals cannot establish a positive expense.',
    };
  }
  if (refund)
    return {
      kind: 'refund',
      reason: 'The source description explicitly says refund.',
      blocker:
        'A source refund cannot be converted to positive spending by editing this draft.',
    };
  if (/\b(?:REVERSAL|REVERSED)\b/i.test(sourceText))
    return {
      kind: 'unknown',
      reason:
        'A reversal does not identify which transaction or direction was reversed.',
      blocker: 'An unresolved reversal cannot establish a positive expense.',
    };
  const creditBlocker = credit
    ? 'A source credit cannot be converted to positive spending by editing this draft.'
    : undefined;
  if (repayment)
    return {
      kind: 'card_repayment',
      reason: 'The source describes a card payment or payment acknowledgement.',
      blocker: creditBlocker,
    };
  if (transfer)
    return {
      kind: 'transfer',
      reason: 'The source description explicitly says transfer.',
      blocker: creditBlocker,
    };
  if (credit)
    return {
      kind: 'other_credit',
      reason:
        'Credit wording or an amount marked CR, negative or in parentheses does not prove a refund.',
      blocker: creditBlocker,
    };
  if (/\b(?:PAYMENT|REPAYMENT)\b/i.test(sourceText))
    return {
      kind: 'unknown',
      reason:
        'Payment wording alone does not establish a purchase or a card repayment. Choose a classification after checking the source.',
    };
  return hasPositiveAmount
    ? {
        kind: 'expense',
        reason:
          'A positive SGD amount was found without a recognized credit, transfer or repayment signal.',
      }
    : {
        kind: 'unknown',
        reason:
          'The source does not establish a supported positive SGD expense.',
      };
}

/** Source issues survive edits; a classification choice is not new amount or
 * currency evidence. This is local review status, never permission to save. */
export function getStatementReview(
  row: StatementCandidate,
  period: StatementPeriod
): Pick<StatementCandidate, 'status' | 'issues'> {
  if (row.isSummary) return { status: 'excluded', issues: row.issues };
  if (row.classification === 'unknown')
    return { status: 'unresolved', issues: row.issues };
  if (row.classification !== 'expense')
    return { status: 'excluded', issues: row.issues };
  const issues = [...row.issues];
  if (
    !calendar.safeParse(row.date).success ||
    row.date < period.from ||
    row.date > period.to
  )
    issues.push('Enter a valid date within the statement period.');
  if (!positiveStatementAmount(row.amount))
    issues.push('Enter a positive SGD amount with exactly two decimal places.');
  if (!row.description.trim()) issues.push('Enter a description.');
  return {
    status: issues.length ? 'unresolved' : 'candidate',
    issues: [...new Set(issues)],
  };
}

function qualifyRow(
  source: StatementLine[],
  period: StatementPeriod,
  billedSgd: boolean,
  uobColumns = false
): StatementCandidate {
  const raw = source.map((line) => line.text).join(' ');
  // In this UOB layout the first date is posting, the second is transaction.
  // Currency/reference continuations remain source evidence, not billed values.
  const transaction = uobColumns ? source[0].text : raw;
  const posting = transaction.match(DATE_PREFIX);
  const afterPosting = posting ? transaction.slice(posting[0].length) : '';
  const match = uobColumns ? afterPosting.match(DATE_PREFIX) : posting;
  const date = match ? statementDate(match, period) : '';
  const body = match
    ? (uobColumns ? afterPosting : transaction).slice(match[0].length).trim()
    : transaction;
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
  const amount = positiveStatementAmount(normalized)
    ? normalized.replaceAll(',', '')
    : '';
  const descriptionEnd = values[0]?.index ?? body.length;
  const description = body
    .slice(0, descriptionEnd)
    .replace(/[|]+/g, ' ')
    .trim();
  const isSummary =
    /\b(?:OPENING BALANCE|CLOSING BALANCE|TOTAL BALANCE|AMOUNT DUE|MINIMUM PAYMENT)\b/i.test(
      body
    );
  const suggestion = suggestClassification(
    uobColumns ? raw : body,
    values,
    Boolean(amount)
  );
  const row: StatementCandidate = {
    id: `${source[0].page}:${source[0].line}`,
    source,
    date,
    description,
    originalDescription: description,
    manualMerchant: { description: false, category: false },
    amount,
    category: 'other',
    classification: isSummary ? 'unknown' : suggestion.kind,
    suggestedClassification: isSummary ? 'unknown' : suggestion.kind,
    classificationReason: isSummary
      ? 'Statement summary: not a transaction.'
      : suggestion.reason,
    isSummary,
    status: 'candidate',
    issues: [],
  };
  if (isSummary) {
    row.amount = '';
    row.issues.push('Statement summary: not a transaction.');
  } else {
    if (suggestion.blocker) {
      row.amount = '';
      row.issues.push(suggestion.blocker);
    }
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
    if (!amount && !suggestion.blocker)
      row.issues.push(
        'A valid positive SGD billed amount is required; no exchange rate is assumed.'
      );
    if (!description) row.issues.push('Description is missing.');
  }
  row.status = getStatementReview(row, period).status;
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
  const uobPages = new Set<number>();
  if (bank === 'uob') {
    for (const page of new Set(lines.map((line) => line.page))) {
      const pageText = lines
        .filter((line) => line.page === page)
        .map((line) => line.text)
        .join(' ')
        .replace(/\s+/g, ' ');
      // PDF text can place both "Date" labels on a second header line.
      if (
        /Post(?: Date)? Trans(?: Date)? Description of Transaction Transaction Amount(?: Date Date)? SGD\b/i.test(
          pageText
        )
      )
        uobPages.add(page);
    }
  }
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
        (!MONEY.test(preceding.map((item) => item.text).join(' ')) ||
          (uobPages.has(line.page) &&
            /^(?:Ref\s*No\s*:|[A-Z]{3}\s+[\d,.]+(?:\s*(?:CR|DR))?$)/i.test(
              line.text.trim()
            ))) &&
        line.text.trim()
      )
        preceding.push(line);
      MONEY.lastIndex = 0;
    }
  }
  const rows = groups.map((source) => {
    const uobColumns = uobPages.has(source[0].page);
    return qualifyRow(
      source,
      period,
      (uobPages.size === 0 && billedSgd) || uobColumns,
      uobColumns
    );
  });
  if (!rows.length)
    throw new Error(
      'No supported transaction rows were found. Image-only and other layouts require manual review.'
    );
  const seen = new Map<string, StatementCandidate>();
  for (const row of rows) {
    if (row.isSummary || !row.date || !positiveStatementAmount(row.amount))
      continue;
    const key = JSON.stringify([
      row.date,
      row.amount,
      row.description.toLowerCase().replace(/\s+/g, ' '),
    ]);
    const duplicate = seen.get(key);
    if (duplicate) {
      for (const entry of [duplicate, row]) {
        if (
          !entry.issues.includes('Possible duplicate: compare the source rows.')
        )
          entry.issues.push('Possible duplicate: compare the source rows.');
        entry.status = getStatementReview(entry, period).status;
      }
    } else seen.set(key, row);
  }
  return rows;
}
