import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
import { describe, expect, it } from 'vitest';

const period = { from: '2026-10-01', to: '2026-10-31' };

function pages(...perPage: string[][]) {
  return perPage.flatMap((texts, p) =>
    texts.map((text, index) => ({ page: p + 1, line: index + 1, text }))
  );
}

const page1 = [
  'SYNTHETIC TEST STATEMENT - NOT A REAL STATEMENT',
  'PayLah! Statement',
  'DBS Bank Ltd',
  'STATEMENT DATE MOBILE NUMBER WALLET ACCOUNT',
  '31 Oct 2026 9000 0000 0000000001',
  'DATE DESCRIPTION AMOUNT',
  'PayLah! Wallet',
  'PREVIOUS BALANCE 10.00 CR',
  '02 Oct EXAMPLE CAFE SINGAPORE 5.50 DB',
  'Ref No.: TESTREF0001',
  '03 Oct TOP UP FROM TEST ACCOUNT 50.00 CR',
  'Ref No.: TESTREF0002',
];
const page2 = [
  'PayLah! Statement',
  'DATE DESCRIPTION AMOUNT',
  '10 Oct SAMPLE MARKET SINGAPORE 12.30 DB',
  'Ref No.: TESTREF0003',
  'Total Balance Carried Forward: 42.20 CR',
];
const text = pages(page1, page2);

describe('DBS PayLah layout', () => {
  const rows = parseStatementLines(text, 'paylah', period);

  it('reads only transaction rows across both pages', () => {
    expect(rows.map((row) => [row.date, row.description, row.amount])).toEqual([
      ['2026-10-02', 'EXAMPLE CAFE SINGAPORE', '5.50'],
      ['2026-10-03', 'TOP UP FROM TEST ACCOUNT', ''],
      ['2026-10-10', 'SAMPLE MARKET SINGAPORE', '12.30'],
    ]);
  });

  it('treats DB as spending and CR as a credit', () => {
    expect(rows.map((row) => row.classification)).toEqual([
      'expense',
      'other_credit',
      'expense',
    ]);
  });

  it('drops Ref No. lines, statement date and balance lines', () => {
    const joined = rows.flatMap((row) => row.source.map((l) => l.text)).join();
    expect(joined).not.toMatch(/Ref No|PREVIOUS BALANCE|Carried Forward/i);
    expect(joined).not.toContain('31 Oct 2026');
    expect(rows.every((row) => !row.description.includes('DB'))).toBe(true);
  });

  it('is not accepted as DBS or Citibank', () => {
    expect(() => parseStatementLines(text, 'dbs', period)).toThrow(
      /could not be identified/
    );
    expect(() => parseStatementLines(text, 'citibank', period)).toThrow(
      /could not be identified/
    );
  });

  it('does not accept DBS card text as PayLah', () => {
    const card = pages([
      'DBS CARDS',
      'DATE DESCRIPTION AMOUNT (S$)',
      '02 OCT EXAMPLE SHOP SINGAPORE 5.50',
    ]);
    expect(() => parseStatementLines(card, 'paylah', period)).toThrow(
      /could not be identified/
    );
  });
});
