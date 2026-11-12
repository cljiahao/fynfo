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

describe('statement period detection from real header shapes', () => {
  const DBS = lines(
    'Statement of Account',
    'STATEMENT DATE CREDIT LIMIT MINIMUM PAYMENT PAYMENT DUE DATE',
    '15 Oct 2026 $9,999.00 $50.00 09 Nov 2026',
    'STATEMENT PRINTED ON 20 Oct 2026'
  );
  const PAYLAH = lines(
    'STATEMENT DATE MOBILE NUMBER WALLET ACCOUNT',
    '15 Oct 2026 99999999 0000000000'
  );
  const CITI = lines(
    'Some left column text YOUR BILL SUMMARY',
    'Left column Statement Date October 15, 2026 ¬',
    'Payment Due Date November 09, 2026'
  );
  const HSBC = lines(
    'Statement period Total Due Minimum Payment Payment Due Date',
    'From 16 SEP 2026 to 15 OCT 2026 1,482.47 25.00 09 Nov 2026'
  );

  it.each([
    ['dbs', DBS, 'statement-date', '2026-09-01', '2026-10-15'],
    ['paylah', PAYLAH, 'statement-date', '2026-09-01', '2026-10-15'],
    ['citibank', CITI, 'statement-date', '2026-09-01', '2026-10-15'],
    ['hsbc', HSBC, 'printed-period', '2026-09-16', '2026-10-15'],
  ] as const)('reads the %s header', (bank, source, basis, from, to) => {
    expect(detectStatementPeriod(source, bank)).toEqual({
      period: { from, to },
      basis,
    });
  });

  it('never returns a payment due or print date as the statement date', () => {
    const due = lines(
      'STATEMENT DATE CREDIT LIMIT MINIMUM PAYMENT PAYMENT DUE DATE',
      '$9,999.00 $50.00 09 Nov 2026',
      'STATEMENT PRINTED ON 20 Oct 2026'
    );
    expect(detectStatementPeriod(due, 'dbs')).toBeNull();
    expect(
      detectStatementPeriod(
        lines('Payment Due Date November 09, 2026'),
        'citibank'
      )
    ).toBeNull();
    expect(
      detectStatementPeriod(
        lines(
          'Statement period Total Due Minimum Payment Payment Due Date',
          '1,482.47 25.00 09 Nov 2026'
        ),
        'hsbc'
      )
    ).toBeNull();
  });

  it('returns null when a bank header disagrees with itself', () => {
    const clash = lines(
      'Statement Date October 15, 2026',
      'Statement Date October 16, 2026'
    );
    expect(detectStatementPeriod(clash, 'citibank')).toBeNull();
  });

  it('falls back to the generic detector when the layout has no reader result', () => {
    expect(
      detectStatementPeriod(lines('Statement Date: 15 Oct 2026'), 'dbs')
    ).toEqual({
      period: { from: '2026-09-01', to: '2026-10-15' },
      basis: 'statement-date',
    });
  });

  it('accepts Mon D, YYYY and Sept in the generic detector', () => {
    expect(
      detectStatementPeriod(lines('Statement Date: Sept 15, 2026'))?.period
    ).toEqual({ from: '2026-08-01', to: '2026-09-15' });
  });

  it('ignores an unparseable labelled line next to a clean one', () => {
    expect(
      detectStatementPeriod(
        lines(
          'Statement Date CREDIT LIMIT PAYMENT DUE DATE',
          'Statement Date: 15 Oct 2026'
        )
      )
    ).toEqual({
      period: { from: '2026-09-01', to: '2026-10-15' },
      basis: 'statement-date',
    });
  });

  it('reads a date that opens a same-line value or a value line', () => {
    expect(
      detectStatementPeriod(lines('Statement Date 15 Oct 2026 Page 1 of 3'))
        ?.period.to
    ).toBe('2026-10-15');
    expect(
      detectStatementPeriod(lines('Statement Date', '15 Oct 2026 12.00'))
        ?.period.to
    ).toBe('2026-10-15');
  });

  it('never reads a date behind another label or after other text', () => {
    expect(
      detectStatementPeriod(lines('Statement Date', 'Total 15 Oct 2026 12.00'))
    ).toBeNull();
    expect(
      detectStatementPeriod(
        lines('Statement Date', 'Payment Due Date 09 Nov 2026')
      )
    ).toBeNull();
    expect(
      detectStatementPeriod(lines('Statement Date: due 15 Oct 2026'))
    ).toBeNull();
  });

  it('counts unparseable date-shaped tokens as dates', () => {
    expect(
      detectStatementPeriod(
        lines('Statement Date: 15 Oct 26 Payment Due 09 Nov 2026')
      )
    ).toBeNull();
    expect(
      detectStatementPeriod(lines('Statement Date: 15 Oct 2026 31 Feb 2026'))
    ).toBeNull();
  });

  it('does not read a range embedded in other text', () => {
    expect(
      detectStatementPeriod(
        lines('Statement Period 15 Oct 2026 note: 1-2-2026 to 3-3-2026')
      )
    ).toBeNull();
  });

  it('returns null when the value line is missing after a bank label line', () => {
    expect(
      detectStatementPeriod(
        lines(
          'STATEMENT DATE CREDIT LIMIT MINIMUM PAYMENT PAYMENT DUE DATE',
          'Thank you for banking with us'
        ),
        'dbs'
      )
    ).toBeNull();
    expect(
      detectStatementPeriod(
        lines(
          'STATEMENT DATE MOBILE NUMBER WALLET ACCOUNT',
          'Thank you for using PayLah'
        ),
        'paylah'
      )
    ).toBeNull();
    expect(
      detectStatementPeriod(
        lines('Statement Date', 'Payment Due Date November 09, 2026'),
        'citibank'
      )
    ).toBeNull();
  });

  it.each(['16SEP 2026', '16 SEP2026', '16SEP2026'])(
    'reads a glued HSBC period start %s',
    (start) => {
      expect(
        detectStatementPeriod(
          lines(
            'Statement period Total Due Minimum Payment Payment Due Date',
            `From ${start} to 15OCT2026 1,482.47 25.00 09 Nov 2026`
          ),
          'hsbc'
        )
      ).toEqual({
        period: { from: '2026-09-16', to: '2026-10-15' },
        basis: 'printed-period',
      });
    }
  );

  it('returns null for an HSBC range split across two lines', () => {
    expect(
      detectStatementPeriod(
        lines(
          'Statement period Total Due Minimum Payment Payment Due Date',
          'From 16 SEP 2026',
          'to 15 OCT 2026'
        ),
        'hsbc'
      )
    ).toBeNull();
  });

  it('does not pick between two dates on one value line or two clean headers', () => {
    expect(
      detectStatementPeriod(
        lines('Statement Date 15 Oct 2026 Payment Due Date 09 Nov 2026')
      )
    ).toBeNull();
    expect(
      detectStatementPeriod(
        lines('Statement Date: 15 Oct 2026', 'Statement Date: 14 Oct 2026')
      )
    ).toBeNull();
  });
});
