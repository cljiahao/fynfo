import {
  parseStatementLines,
  positionedStatementLines,
  validStatementPeriod,
} from '@/features/import-review/lib/statement-parser';
import { describe, expect, it } from 'vitest';
const period = { from: '2025-12-15', to: '2026-01-14' };
function lines(...text: string[]) {
  return text.map((value, index) => ({
    page: 1,
    line: index + 1,
    text: value,
  }));
}
describe('conservative local statement parsing', () => {
  it('resolves year rollover solely from the supplied statement period', () => {
    const rows = parseStatementLines(
      lines(
        'UOB',
        'Transaction date Description SGD billed',
        '31 DEC Synthetic market SGD 12.30',
        '02 JAN Synthetic cafe SGD 8.20'
      ),
      'uob',
      period
    );
    expect(rows.map((row) => [row.date, row.amount, row.status])).toEqual([
      ['2025-12-31', '12.30', 'candidate'],
      ['2026-01-02', '8.20', 'candidate'],
    ]);
  });
  it('retains continuation provenance, separates billed SGD and excludes credits/repayments', () => {
    const rows = parseStatementLines(
      lines(
        'DBS',
        'Transaction date Description SGD billed',
        '20 DEC LONG MERCHANT',
        'MERCHANT DESCRIPTION SGD 15.00',
        '21 DEC FOREIGN STORE USD 10.00 SGD 13.80',
        '22 DEC REFUND SGD 5.00 CR',
        '23 DEC CARD PAYMENT SGD 100.00 CR'
      ),
      'dbs',
      period
    );
    expect(rows[0].source).toHaveLength(2);
    expect(rows[0].description).toBe('LONG MERCHANT MERCHANT DESCRIPTION');
    expect(rows[1].amount).toBe('13.80');
    expect(rows.slice(2).map((row) => row.status)).toEqual([
      'excluded',
      'excluded',
    ]);
  });
  it('does not invent an SGD conversion or normalize invalid money', () => {
    const rows = parseStatementLines(
      lines(
        'Citibank',
        '20 DEC USD ONLY USD 7.00',
        '21 DEC BAD SGD 1,23.45',
        '22 DEC NEGATIVE SGD -3.00'
      ),
      'citibank',
      period
    );
    expect(rows.map((row) => row.status)).toEqual([
      'unresolved',
      'unresolved',
      'excluded',
    ]);
    expect(rows.every((row) => row.amount === '')).toBe(true);
  });
  it('excludes dated summaries and transfers while retaining their source', () => {
    const rows = parseStatementLines(
      lines(
        'HSBC',
        '20 DEC TOTAL BALANCE SGD 100.00',
        '21 DEC TRANSFER TO SAVINGS SGD 200.00'
      ),
      'hsbc',
      period
    );
    expect(rows.every((row) => row.status === 'excluded')).toBe(true);
    expect(rows[0].source[0].line).toBe(2);
  });
  it('does not truncate extra decimals, debit suffixes or unsafe amounts into suggestions', () => {
    const rows = parseStatementLines(
      lines(
        'UOB',
        '20 DEC SHOP SGD 1.234',
        '21 DEC SHOP SGD 2.00 DR',
        '22 DEC SHOP SGD 999999999999999999999999.00'
      ),
      'uob',
      period
    );
    expect(
      rows.every((row) => row.status === 'unresolved' && row.amount === '')
    ).toBe(true);
  });
  it('marks all equal candidate repeats rather than dropping them', () => {
    const rows = parseStatementLines(
      lines(
        'UOB',
        '20 DEC MARKET SGD 15.00',
        '20 DEC MARKET SGD 15.00',
        '20 DEC MARKET SGD 15.00'
      ),
      'uob',
      period
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === 'unresolved')).toBe(true);
  });
  it('keeps impossible or out-of-period dates unresolved', () => {
    const rows = parseStatementLines(
      lines('DBS', '31 FEB MARKET SGD 15.00', '03/04 SHOP SGD 2.00'),
      'dbs',
      period
    );
    expect(
      rows.every((row) => row.date === '' && row.status === 'unresolved')
    ).toBe(true);
  });
  it.each(['uob', 'dbs', 'hsbc', 'citibank'] as const)(
    'qualifies the explicitly identified %s variant',
    (bank) => {
      expect(
        parseStatementLines(
          lines(bank.toUpperCase(), '20 DEC MARKET SGD 15.00'),
          bank,
          period
        )[0].status
      ).toBe('candidate');
    }
  );
  it('rejects missing/mismatched bank and unsupported/image-only text', () => {
    expect(() =>
      parseStatementLines(lines('HSBC', '20 DEC SHOP SGD 2.00'), 'uob', period)
    ).toThrow();
    expect(() =>
      parseStatementLines(lines('UOB', 'Nothing recognized'), 'uob', period)
    ).toThrow();
    expect(() => parseStatementLines([], 'uob', period)).toThrow();
  });
  it('requires valid bounded date ranges', () => {
    expect(validStatementPeriod(period)).toBe(true);
    expect(validStatementPeriod({ from: '2026-02-30', to: '2026-03-01' })).toBe(
      false
    );
    expect(validStatementPeriod({ from: '2026-01-01', to: '2025-01-01' })).toBe(
      false
    );
    expect(validStatementPeriod({ from: '2020-01-01', to: '2026-01-01' })).toBe(
      false
    );
  });
  it('reconstructs positioned columns in reading order with page/line identity', () => {
    expect(
      positionedStatementLines(
        [
          { text: 'SGD 2.00', x: 400, y: 200 },
          { text: '20 DEC', x: 10, y: 201 },
          { text: 'SHOP', x: 100, y: 200 },
          { text: 'HEADER', x: 10, y: 250 },
        ],
        2
      )
    ).toEqual([
      { page: 2, line: 1, text: 'HEADER' },
      { page: 2, line: 2, text: '20 DEC SHOP SGD 2.00' },
    ]);
  });
});
