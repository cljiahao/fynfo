import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
import { describe, expect, it } from 'vitest';

const period = { from: '2025-12-15', to: '2026-01-14' };

function pages(...perPage: string[][]) {
  return perPage.flatMap((texts, p) =>
    texts.map((text, index) => ({ page: p + 1, line: index + 1, text }))
  );
}

const HEADER = 'DATE DESCRIPTION AMOUNT (SGD)';

const page1 = [
  'SYNTHETIC TEST STATEMENT - NOT A REAL STATEMENT',
  'CITIBANK TEST CARDS',
  'STATEMENT DATE CREDIT LIMIT MINIMUM PAYMENT PAYMENT DUE DATE',
  '14 JAN 2026 1,000.00 50.00 08 FEB 2026',
  '0 0 0 0 0 0 0 0 0 0 0 0',
];
const page2 = [
  HEADER,
  'TRANSACTIONS FOR CITI TEST ALPHA CARD',
  'BALANCE PREVIOUS STATEMENT 100.00',
  'CITI TEST ALPHA CARD 4111-1111-1111-0000 - TEST USER',
  '20 DEC EXAMPLE MARKET SINGAPORE SG 12.50',
  '31 DEC SAMPLE ONLINE LONDON GB SGD 20.00 0.60 20.60',
  '01 JAN OVERSEAS SHOP TOKYO JP 45.00',
  'FOREIGN AMOUNT JAPANESE YEN 4,500.00',
  '02 JAN PAYMENT THANK YOU (100.00)',
  'XXXX-XXXX-XXXX-1234',
  'SUB-TOTAL: 57.50',
];
const page3 = [
  HEADER,
  'TRANSACTIONS FOR CITI TEST BETA CARD',
  'BALANCE PREVIOUS STATEMENT 0.00',
  '05 JAN DEMO STORE SINGAPORE SG 7.30 1234567890123456',
  'SUB-TOTAL: 7.30',
  'GRAND TOTAL 64.80',
  '10 JAN 4321 SLIP DIGITS 1.00',
];

describe('Citibank credit card layout', () => {
  const rows = parseStatementLines(
    pages(page1, page2, page3),
    'citibank',
    period
  );

  it('reads both card sections', () => {
    expect(rows.map((row) => [row.date, row.amount])).toEqual([
      ['2025-12-20', '12.50'],
      ['2025-12-31', '20.60'],
      ['2026-01-01', '45.00'],
      ['2026-01-02', ''],
      ['2026-01-05', '7.30'],
    ]);
  });

  it('treats a parenthesised amount as a credit', () => {
    expect(rows.find((row) => /PAYMENT/.test(row.description))).toMatchObject({
      classification: 'card_repayment',
      status: 'excluded',
      amount: '',
    });
  });

  it('keeps the FOREIGN AMOUNT continuation out of the row and amount', () => {
    const fx = rows.find((row) => row.description.startsWith('OVERSEAS'));
    expect(fx?.amount).toBe('45.00');
    expect(fx?.description).not.toMatch(/4,500|FOREIGN/);
    expect(fx?.source).toHaveLength(1);
  });

  it('drops the SGD trailer when a final amount follows it', () => {
    const row = rows.find((r) => r.description.startsWith('SAMPLE ONLINE'));
    expect(row).toMatchObject({ amount: '20.60', status: 'candidate' });
  });

  it('does not read a trailing 16-digit reference as the amount', () => {
    expect(rows.find((r) => r.description.startsWith('DEMO'))).toMatchObject({
      amount: '7.30',
      status: 'candidate',
    });
  });

  it('yields no rows for summary, footer, balance, card and slip lines', () => {
    const all = rows.flatMap((row) => row.source.map((line) => line.text));
    for (const noise of [
      '14 JAN 2026 1,000.00 50.00 08 FEB 2026',
      '0 0 0 0 0 0 0 0 0 0 0 0',
      'BALANCE PREVIOUS STATEMENT 100.00',
      'XXXX-XXXX-XXXX-1234',
      'SUB-TOTAL: 57.50',
      'GRAND TOTAL 64.80',
    ])
      expect(all).not.toContain(noise);
    expect(all.some((text) => text.includes('SLIP DIGITS'))).toBe(false);
    expect(rows).toHaveLength(5);
  });

  it('does not claim other banks text', () => {
    expect(() =>
      parseStatementLines(
        pages([
          'DBS TEST CARD',
          'DATE DESCRIPTION AMOUNT (S$)',
          '20 DEC SHOP 12.50',
        ]),
        'citibank',
        period
      )
    ).toThrow('The selected bank could not be identified');
    expect(() =>
      parseStatementLines(
        pages(['CITIBANK', 'NO TRANSACTIONS HERE']),
        'citibank',
        period
      )
    ).toThrow('No supported transaction rows were found');
  });
});
