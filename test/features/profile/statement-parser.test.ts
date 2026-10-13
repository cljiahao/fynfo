import {
  getStatementReview,
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
  it('reconstructs split UOB headings and two-date rows from positioned PDF text', () => {
    const positioned = positionedStatementLines(
      [
        { text: 'UOB', x: 40, y: 700 },
        { text: 'Post', x: 40, y: 650 },
        { text: 'Trans', x: 90, y: 650 },
        { text: 'Description of Transaction', x: 150, y: 650 },
        { text: 'Transaction Amount', x: 450, y: 650 },
        { text: 'Date', x: 40, y: 640 },
        { text: 'Date', x: 90, y: 640 },
        { text: 'SGD', x: 520, y: 640 },
        { text: '22 DEC', x: 40, y: 600 },
        { text: '20 DEC', x: 90, y: 600 },
        { text: 'SAMPLE SHOP', x: 150, y: 600 },
        { text: '14.70', x: 520, y: 600 },
        { text: 'Ref No : SYNTHETIC', x: 150, y: 590 },
        { text: 'USD 10.00', x: 150, y: 580 },
      ].reverse(),
      1
    );
    const [row] = parseStatementLines(positioned, 'uob', period);
    expect(row).toMatchObject({
      date: '2025-12-20',
      description: 'SAMPLE SHOP',
      amount: '14.70',
      status: 'candidate',
    });
    expect(row.source).toHaveLength(3);
  });
  it.each([
    [
      'Post Trans Description of Transaction Transaction Amount',
      'Date Date SGD',
    ],
    ['Post Date Trans Date Description of Transaction Transaction Amount SGD'],
  ])('reads the UOB two-date SGD layout: %s', (...header) => {
    const rows = parseStatementLines(
      lines(
        'UOB',
        ...header,
        '22 DEC 20 DEC SAMPLE SHOP 14.70',
        'Ref No : SYNTHETIC-REFERENCE',
        'USD 10.00',
        '03 JAN 02 JAN SAMPLE CAFE 9.40',
        'SUB TOTAL 24.10',
        'TOTAL BALANCE FOR SAMPLE CARD 24.10',
        '04 JAN 03 JAN PAYMT THRU SAMPLE 24.10 CR'
      ),
      'uob',
      period
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      date: '2025-12-20',
      description: 'SAMPLE SHOP',
      originalDescription: 'SAMPLE SHOP',
      amount: '14.70',
      status: 'candidate',
    });
    expect(rows[0].source.map((line) => line.text)).toEqual([
      '22 DEC 20 DEC SAMPLE SHOP 14.70',
      'Ref No : SYNTHETIC-REFERENCE',
      'USD 10.00',
    ]);
    expect(rows[1]).toMatchObject({
      date: '2026-01-02',
      description: 'SAMPLE CAFE',
      amount: '9.40',
      status: 'candidate',
    });
    expect(rows[2]).toMatchObject({
      classification: 'card_repayment',
      amount: '',
      status: 'excluded',
    });
  });
  it('does not guess UOB billed amounts for missing dates, multiple amounts or another page without a header', () => {
    const rows = parseStatementLines(
      [
        ...lines(
          'UOB',
          'Post Date Trans Date Description of Transaction Transaction Amount SGD',
          '22 DEC SAMPLE SHOP 14.70',
          '23 DEC 22 DEC SAMPLE SHOP 10.00 14.70'
        ),
        { page: 2, line: 1, text: '24 DEC 23 DEC SAMPLE SHOP 18.00' },
      ],
      'uob',
      period
    );
    expect(rows.every((row) => row.status === 'unresolved')).toBe(true);
    expect(rows[1].amount).toBe('');
    expect(rows[2].amount).toBe('');
  });
  it.each([
    ['MARKET SGD 12.30', 'expense', 'candidate'],
    ['REFUND SGD 5.00 CR', 'refund', 'excluded'],
    ['REFUND SGD 5.00', 'refund', 'excluded'],
    ['SHOP SGD 5.00 REFUND', 'refund', 'excluded'],
    ['TRANSFER TO SAVINGS SGD 200.00', 'transfer', 'excluded'],
    ['TRANSFER FROM SAVINGS SGD 200.00 CR', 'transfer', 'excluded'],
    ['CARD PAYMENT SGD 100.00 CR', 'card_repayment', 'excluded'],
    ['BANK SGD 100.00 CARD PAYMENT', 'card_repayment', 'excluded'],
    ['BANK SGD 100.00 TRANSFER', 'transfer', 'excluded'],
    ['CREDIT CARD REPAYMENT SGD 100.00', 'card_repayment', 'excluded'],
    ['PAYMENT THANK YOU SGD 100.00 CR', 'card_repayment', 'excluded'],
    ['MARKET SGD -3.00', 'other_credit', 'excluded'],
    ['MARKET SGD (3.00)', 'other_credit', 'excluded'],
    ['MARKET SGD 3.00 CR', 'other_credit', 'excluded'],
    ['DIVIDEND SGD 3.00', 'other_credit', 'excluded'],
    ['PAYMENT RECEIVED SGD 3.00 CR', 'other_credit', 'excluded'],
    ['PAYMENT SGD 12.30', 'unknown', 'unresolved'],
    ['REPAYMENT SGD 12.30', 'unknown', 'unresolved'],
    ['REVERSAL SGD 3.00 CR', 'unknown', 'unresolved'],
    ['SHOP SGD 3.00 REVERSAL', 'unknown', 'unresolved'],
    ['REFUND CARD PAYMENT SGD 3.00 CR', 'unknown', 'unresolved'],
    ['CREDIT SGD 3.00 DR', 'unknown', 'unresolved'],
    ['FOREIGN USD 3.00', 'unknown', 'unresolved'],
  ] as const)(
    'classifies %s as %s without losing evidence',
    (text, kind, status) => {
      const source = `20 DEC ${text}`;
      const [row] = parseStatementLines(lines('UOB', source), 'uob', period);
      expect(row.classification).toBe(kind);
      expect(row.suggestedClassification).toBe(kind);
      expect(row.status).toBe(status);
      expect(row.classificationReason).not.toBe('');
      expect(row.source[0].text).toBe(source);
    }
  );
  it.each([
    'REFUND SGD 3.00',
    'SHOP SGD 3.00 REFUND',
    'SHOP SGD -3.00',
    'SHOP SGD (3.00)',
    'CARD PAYMENT SGD 3.00 CR',
    'REFUND TRANSFER SGD 3.00',
    'REVERSAL SGD 3.00',
    'SHOP SGD 3.00 REVERSAL',
  ])('retains a source blocker after relabeling %s as an expense', (text) => {
    const [row] = parseStatementLines(
      lines('UOB', `20 DEC ${text}`),
      'uob',
      period
    );
    expect(row.amount).toBe('');
    const edited = {
      ...row,
      classification: 'expense' as const,
      amount: '3.00',
      description: 'Edited purchase',
    };
    expect(getStatementReview(edited, period).status).toBe('unresolved');
    expect(getStatementReview(edited, period).issues).toEqual(
      expect.arrayContaining(row.issues)
    );
    expect(edited.suggestedClassification).toBe(row.suggestedClassification);
    expect(edited.source).toBe(row.source);
  });
  it('allows an explicit review choice for ambiguous payment wording with valid positive evidence', () => {
    const [row] = parseStatementLines(
      lines('UOB', '20 DEC PAYMENT SGD 12.30'),
      'uob',
      period
    );
    expect(getStatementReview(row, period).status).toBe('unresolved');
    expect(
      getStatementReview({ ...row, classification: 'expense' }, period).status
    ).toBe('candidate');
    expect(
      getStatementReview({ ...row, classification: 'transfer' }, period).status
    ).toBe('excluded');
    expect(row.classification).toBe('unknown');
  });
  it('revalidates draft fields and never clears original extraction issues', () => {
    const [row] = parseStatementLines(
      lines('UOB', '20 DEC SHOP SGD 12.30'),
      'uob',
      period
    );
    for (const edit of [
      { amount: '-12.30' },
      { amount: '0.00' },
      { amount: '12.345' },
      { date: '2026-02-30' },
      { date: '2026-02-01' },
      { description: '  ' },
    ]) {
      expect(getStatementReview({ ...row, ...edit }, period).status).toBe(
        'unresolved'
      );
    }
    expect(getStatementReview(row, period).status).toBe('candidate');
    const [foreign] = parseStatementLines(
      lines('UOB', '20 DEC SHOP USD 12.30'),
      'uob',
      period
    );
    expect(
      getStatementReview(
        { ...foreign, classification: 'expense', amount: '12.30' },
        period
      ).status
    ).toBe('unresolved');
    const duplicates = parseStatementLines(
      lines('UOB', '20 DEC SHOP SGD 12.30', '20 DEC SHOP SGD 12.30'),
      'uob',
      period
    );
    expect(
      getStatementReview({ ...duplicates[0], description: 'Changed' }, period)
        .status
    ).toBe('unresolved');
  });
  it('keeps summary lines excluded even when supplied a changed classification and amount', () => {
    const [row] = parseStatementLines(
      lines('UOB', '20 DEC MINIMUM PAYMENT SGD 10.00'),
      'uob',
      period
    );
    expect(row.isSummary).toBe(true);
    expect(
      getStatementReview(
        { ...row, classification: 'expense', amount: '10.00' },
        period
      ).status
    ).toBe('excluded');
  });
  it.each(['PAYMENT', 'TRANSFER', 'CARD PAYMENT'])(
    'retains duplicate source evidence when %s rows are reclassified',
    (description) => {
      const rows = parseStatementLines(
        lines(
          'UOB',
          `20 DEC ${description} SGD 12.30`,
          `20 DEC ${description} SGD 12.30`
        ),
        'uob',
        period
      );
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.issues).toContain(
          'Possible duplicate: compare the source rows.'
        );
        expect(
          getStatementReview({ ...row, classification: 'expense' }, period)
            .status
        ).toBe('unresolved');
        expect(getStatementReview(row, period).status).toBe(
          description === 'PAYMENT' ? 'unresolved' : 'excluded'
        );
      }
    }
  );
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
