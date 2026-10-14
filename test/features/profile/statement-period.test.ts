import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
import { detectStatementPeriod } from '@/features/import-review/lib/statement-period';
import { describe, expect, it } from 'vitest';

const lines = (...text: string[]) =>
  text.map((text, index) => ({ page: 1, line: index + 1, text }));

describe('statement period detection', () => {
  it.each([
    '14 JAN 2026',
    '14 January 2026',
    '14/01/2026',
    '14-01-2026',
    '2026-01-14',
  ])(
    'reads labelled full-year date %s and crosses into the previous year',
    (date) => {
      expect(detectStatementPeriod(lines(`Statement Date: ${date}`))).toEqual({
        period: { from: '2025-12-01', to: '2026-01-14' },
        basis: 'statement-date',
      });
    }
  );
  it('keeps a printed period exact, accepts repeated consistent headers and an adjacent date value', () => {
    expect(
      detectStatementPeriod(
        lines(
          'Statement Period: 15 DEC 2025 to 14 JAN 2026',
          'Statement Date',
          '14 JAN 2026',
          'Statement Date: 14 JAN 2026'
        )
      )
    ).toEqual({
      period: { from: '2025-12-15', to: '2026-01-14' },
      basis: 'printed-period',
    });
  });
  it.each([
    ['Statement Month: February 2024', '2024-01-01', '2024-02-29'],
    ['Statement For: FEB 2025', '2025-01-01', '2025-02-28'],
    ['Statement Month: January 2026', '2025-12-01', '2026-01-31'],
    ['Statement Month: December 2026', '2026-11-01', '2026-12-31'],
  ])(
    'uses the printed month with a conservative preceding-month window',
    (header, from, to) => {
      expect(detectStatementPeriod(lines(header))).toEqual({
        period: { from, to },
        basis: 'statement-month',
      });
    }
  );
  it.each([
    ['Payment Due Date: 14 JAN 2026'],
    ['31 DEC MARKET SGD 12.30'],
    ['Statement Date: 14 JAN'],
    ['Statement Date: 14 JAN 26'],
    ['Statement Date: 31 FEB 2026'],
    ['Statement Month: Jann 2026'],
    ['Statement Date: 14 JAN 2026', 'Statement Date: 15 JAN 2026'],
    ['Statement Date: 14 JAN 2026', 'Statement Month: February 2026'],
    [
      'Statement Period: 15 DEC 2025 to 13 JAN 2026',
      'Statement Date: 14 JAN 2026',
    ],
    ['Statement Period: 15 JAN 2026 to 14 JAN 2026'],
    ['Statement Period: 01 JAN 2020 to 14 JAN 2026'],
    [
      'Statement Period: 01 JAN 2026 to 14 JAN 2026',
      'Statement Period: 02 JAN 2026 to 14 JAN 2026',
    ],
    ['Statement Date: 0000-01-01'],
  ])(
    'requires fallback for absent, ambiguous, conflicting or invalid evidence: %j',
    (...text) => {
      expect(detectStatementPeriod(lines(...text))).toBeNull();
    }
  );
  it('does not join a label to a value on another page', () => {
    expect(
      detectStatementPeriod([
        { page: 1, line: 1, text: 'Statement Date' },
        { page: 2, line: 1, text: '14 JAN 2026' },
      ])
    ).toBeNull();
  });
  it('uses printed evidence, retains transaction dates and leaves older/future rows unresolved', () => {
    const source = lines(
      'UOB',
      'Statement Date: 14 JAN 2026',
      '31 DEC MARKET SGD 12.30',
      '02 JAN SHOP SGD 5.00',
      '01 NOV OLD SHOP SGD 2.00',
      '20 JAN LATER SHOP SGD 3.00'
    );
    const detected = detectStatementPeriod(source)!;
    const rows = parseStatementLines(source, 'uob', detected.period);
    expect(rows.map((row) => row.date)).toEqual([
      '2025-12-31',
      '2026-01-02',
      '',
      '',
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      'candidate',
      'candidate',
      'unresolved',
      'unresolved',
    ]);
  });
});
