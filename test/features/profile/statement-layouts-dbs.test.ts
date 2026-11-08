import {
  parseStatementLines,
  positionedStatementLines,
} from '@/features/import-review/lib/statement-parser';
import { describe, expect, it } from 'vitest';

const period = { from: '2025-12-15', to: '2026-01-14' };

function pages(...perPage: string[][]) {
  return perPage.flatMap((texts, p) =>
    texts.map((text, index) => ({ page: p + 1, line: index + 1, text }))
  );
}

const HEADER = 'DATE DESCRIPTION AMOUNT (S$)';

const page1 = [
  'SYNTHETIC TEST STATEMENT - NOT A REAL STATEMENT',
  'DBS TEST CARDS',
  'STATEMENT DATE CREDIT LIMIT MINIMUM PAYMENT PAYMENT DUE DATE',
  '14 JAN 2026 1,000.00 50.00 08 FEB 2026',
  '0 0 0 0 0 0 0 0 0 0 0 0',
  HEADER,
  'DBS TEST ALPHA CARD CARD NO.: 4111 1111 1111 0000',
  'PREVIOUS BALANCE 100.00',
  'NEW TRANSACTIONS TEST USER',
  '20 DEC EXAMPLE MARKET 12.50',
  '31 DEC SAMPLE CAFE 1,234.56',
  '02 JAN PAYMENT RECEIVED 100.00 CR',
  'REF NO: 000000000001',
  'SUB-TOTAL: 1,247.06',
  'TOTAL: 1,247.06',
];
const page2 = [
  HEADER,
  'DBS TEST BETA CARD CARD NO.: 4111 1111 1111 0001',
  'PREVIOUS BALANCE 0.00',
  'NEW TRANSACTIONS TEST USER',
  '05 JAN DEMO STORE 7.30',
  '10 JAN SAMPLE REFUND 3.00 CR',
  'SUB-TOTAL: 7.30',
  'GRAND TOTAL FOR ALL CARD ACCOUNTS: 1,254.36',
  'STATEMENT PRINTED ON 14 Jan 2026',
];

describe('DBS credit card layout', () => {
  const rows = parseStatementLines(pages(page1, page2), 'dbs', period);

  it('reads both cards with year taken from the period across Dec/Jan', () => {
    expect(rows.map((row) => [row.date, row.description, row.amount])).toEqual([
      ['2025-12-20', 'EXAMPLE MARKET', '12.50'],
      ['2025-12-31', 'SAMPLE CAFE', '1234.56'],
      ['2026-01-02', 'PAYMENT RECEIVED', ''],
      ['2026-01-05', 'DEMO STORE', '7.30'],
      ['2026-01-10', 'SAMPLE REFUND', ''],
    ]);
    expect(
      rows.filter((row) => row.status === 'candidate').map((row) => row.date)
    ).toEqual(['2025-12-20', '2025-12-31', '2026-01-05']);
  });

  it('treats CR rows as credits that are never expense suggestions', () => {
    const payment = rows.find((row) => row.description === 'PAYMENT RECEIVED');
    const refund = rows.find((row) => row.description === 'SAMPLE REFUND');
    expect(payment).toMatchObject({
      classification: 'other_credit',
      status: 'excluded',
      amount: '',
    });
    expect(refund).toMatchObject({
      classification: 'refund',
      status: 'excluded',
    });
  });

  it('keeps REF NO as provenance without producing a row', () => {
    const payment = rows.find((row) => row.description === 'PAYMENT RECEIVED');
    expect(payment?.source.map((line) => line.text)).toEqual([
      '02 JAN PAYMENT RECEIVED 100.00 CR',
      'REF NO: 000000000001',
    ]);
    expect(rows).toHaveLength(5);
  });

  it('yields no rows for summary, slip, footer and section lines', () => {
    const all = rows.flatMap((row) => row.source.map((line) => line.text));
    for (const noise of [
      '14 JAN 2026 1,000.00 50.00 08 FEB 2026',
      '0 0 0 0 0 0 0 0 0 0 0 0',
      'STATEMENT PRINTED ON 14 Jan 2026',
      'SUB-TOTAL: 7.30',
      'TOTAL: 1,247.06',
      'GRAND TOTAL FOR ALL CARD ACCOUNTS: 1,254.36',
      'PREVIOUS BALANCE 100.00',
      'NEW TRANSACTIONS TEST USER',
    ])
      expect(all).not.toContain(noise);
  });

  it('qualifies rows from positioned text with the S$ header', () => {
    const positioned = positionedStatementLines(
      [
        { text: 'DBS', x: 57, y: 700 },
        { text: 'DATE', x: 57, y: 650 },
        { text: 'DESCRIPTION', x: 124, y: 650 },
        { text: 'AMOUNT (S$)', x: 502, y: 650 },
        { text: '20 DEC', x: 54, y: 600 },
        { text: 'EXAMPLE MARKET', x: 95, y: 600 },
        { text: '12.50', x: 525, y: 600 },
      ].reverse(),
      1
    );
    const [row] = parseStatementLines(positioned, 'dbs', period);
    expect(row).toMatchObject({
      date: '2025-12-20',
      description: 'EXAMPLE MARKET',
      amount: '12.50',
      status: 'candidate',
    });
  });

  it('does not guess foreign-currency or ambiguous amounts', () => {
    const [row] = parseStatementLines(
      pages(['DBS TEST', HEADER, '20 DEC SAMPLE ONLINE USD 10.00 13.50']),
      'dbs',
      period
    );
    expect(row.status).not.toBe('candidate');
    expect(row.amount).toBe('');
  });

  it('fails visibly when the DBS header is absent or renamed', () => {
    expect(() =>
      parseStatementLines(
        pages(['DBS TEST', 'NO TRANSACTIONS HERE']),
        'dbs',
        period
      )
    ).toThrow('No supported transaction rows were found');
    const renamed = parseStatementLines(
      pages(['DBS TEST', 'DATE DESCRIPTION AMOUNT', '20 DEC SHOP 12.50']),
      'dbs',
      period
    );
    expect(renamed.every((row) => row.status !== 'candidate')).toBe(true);
  });

  it('does not claim DBS PayLah statements as card statements', () => {
    expect(() =>
      parseStatementLines(
        pages([
          'PayLah! STATEMENT',
          'DBS Bank Ltd',
          HEADER,
          '20 DEC EXAMPLE MARKET 12.50',
        ]),
        'dbs',
        period
      )
    ).toThrow('The selected bank could not be identified');
  });
});
