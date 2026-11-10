import { reconcileStatement } from '@/features/import-review/lib/statement-guards';
import { dbsLayout } from '@/features/import-review/lib/statement-layouts/dbs';
import { hsbcLayout } from '@/features/import-review/lib/statement-layouts/hsbc';
import { paylahLayout } from '@/features/import-review/lib/statement-layouts/paylah';
import { uobLayout } from '@/features/import-review/lib/statement-layouts/uob';
import {
  parseStatementLines,
  positionedStatementLines,
  statementTotalBlocks,
} from '@/features/import-review/lib/statement-parser';
import { detectStatementPeriod } from '@/features/import-review/lib/statement-period';
import type {
  PositionedStatementText,
  StatementLine,
} from '@/features/import-review/types';
import { describe, expect, it } from 'vitest';

type Cell = [text: string, x: number, confidence?: number];

/** One OCR line: table-column cells, then the merged account-summary cells. */
function line(y: number, table: Cell[], summary: Cell[] = []) {
  return [...table, ...summary].map(
    ([text, x, confidence = 92]): PositionedStatementText => ({
      text,
      x,
      y,
      confidence,
    })
  );
}

const SUMMARY_NOISE = {
  total: ['Total', 390, 5] as Cell,
  balance: ['9,999.99', 520, 5] as Cell,
};

function page1(statementDate: string, rows: PositionedStatementText[][]) {
  const [day, month, year] = statementDate.split(' ');
  return [
    line(
      620,
      [['Please examine this statement immediately.', 60]],
      [
        ['ACCOUNT', 400],
        ['SUMMARY', 440],
        ['SGD', 480],
      ]
    ),
    line(
      600,
      [['Notice', 60]],
      [
        ['Previous', 390],
        ['Statement', 430],
        ['Balance', 470],
      ]
    ),
    line(
      590,
      [],
      [
        ['Statement', 388],
        ['Date', 430],
      ]
    ),
    line(
      575,
      [],
      [
        ['SGD', 388],
        [day, 427],
        [month, 440],
        [year, 461],
      ]
    ),
    line(
      555,
      [
        ['POST', 58],
        ['TRAN', 102],
      ],
      [
        ['Payments', 390],
        ['9,999.99cr', 500],
      ]
    ),
    line(
      540,
      [
        ['DATE', 58],
        ['DATE', 103],
        ['DESCRIPTION', 142],
        ['AMOUNT(SGD)', 280],
      ],
      [
        ['Purchases', 390],
        ['8,888.88', 520],
      ]
    ),
    line(
      525,
      [
        ['TEST', 60],
        ['9999-X9XCCXXXX9999', 111, 30],
      ],
      [
        ['GST', 390],
        ['Charges', 420],
      ]
    ),
    line(
      510,
      [
        ['Previous', 141],
        ['Statement', 170],
        ['Balance', 205],
        ['1,111.11', 333],
      ],
      [
        ['GST', 390],
        ['Reversals', 420],
      ]
    ),
    ...rows,
    line(
      200,
      [
        ['Download', 60],
        ['the', 100],
        ['HSBC', 120],
        ['Singapore', 150],
      ],
      [['hsbc.com.sg', 400]]
    ),
    line(100, [['SAMPLE PERSON', 55]]),
    line(85, [['1 EXAMPLE ROAD', 55]]),
    line(70, [['SINGAPORE 000000', 55]]),
  ].flat();
}

const ROWS: PositionedStatementText[][] = [
  line(
    495,
    [
      ['28', 60],
      ['Aug', 71],
      ['30', 101],
      ['Aug', 112],
      ['SAMPLE MART SINGAPORE', 141],
      ['45.60', 349],
    ],
    [SUMMARY_NOISE.total, SUMMARY_NOISE.balance]
  ),
  // Day and month glued in both date columns.
  line(
    480,
    [
      ['07Sep', 60],
      ['09Sep', 101],
      ['CAFE EXAMPLE', 141],
      ['12.30', 349],
    ],
    [
      ['Minimum', 390],
      ['50.00', 520],
    ]
  ),
  // Credit with a glued CR suffix and divider glyphs left of the summary.
  line(
    465,
    [
      ['10', 60],
      ['Sep', 71],
      ['11', 101],
      ['Sep', 112],
      ['PAYMENT VIA TESTBANK', 141],
      ['1,000.00CR', 333],
      ['-—', 386],
      [':.', 390],
    ],
    [
      ['CREDIT', 400],
      ['LIMIT', 440],
    ]
  ),
  // Country-code continuation with a junk token in the date column.
  line(450, [
    ['BEE', 56, 20],
    ['SG', 141, 20],
  ]),
  // Low-confidence description word; divider glyph inside the left band.
  line(
    435,
    [
      ['12', 60],
      ['Sep', 71],
      ['13', 101],
      ['Sep', 112],
      ['ONLINE', 141, 30],
      ['SHOP EXAMPLE', 190],
      ['1,234.56', 333],
      ['_—', 383],
    ],
    [
      ['Credit', 400, 3],
      ['Limit', 440, 3],
      ['5,000', 500, 3],
    ]
  ),
  // Misread description passes through untouched.
  line(420, [
    ['14', 60],
    ['Sep', 71],
    ['14', 101],
    ['Sep', 112],
    ['5ample Servlce', 141],
    ['78.90', 349],
  ]),
  line(
    405,
    [
      ['GST', 56],
      ['RECT', 141],
    ],
    [
      ['REWARDS', 400],
      ['SUMMARY', 440],
    ]
  ),
  line(
    380,
    [
      ['Total', 141],
      ['Due', 177],
      ['371.36', 316],
    ],
    [
      ['Points', 400],
      ['12,345', 500],
    ]
  ),
];

const PAGE2 = [
  line(
    700,
    [['1. Payment of the minimum amount only', 17]],
    [['2. Interest', 301]]
  ),
  // A date-shaped line in boilerplate must not become a row.
  line(680, [['28 Aug 30 Aug SAMPLE TERMS 10.00', 17]]),
  line(660, [['3. Charges may change', 17]], [['4. Disputes', 301]]),
].flat();

function statement(statementDate = '15 Sep 2026', rows = ROWS) {
  const lines: StatementLine[] = [
    ...positionedStatementLines(page1(statementDate, rows), 1),
    ...positionedStatementLines(PAGE2, 2),
  ];
  const period = detectStatementPeriod(lines)?.period;
  if (!period) throw new Error('period not detected');
  return { lines, period };
}

describe('HSBC OCR layout', () => {
  const { lines, period } = statement();
  const rows = parseStatementLines(lines, 'hsbc', period);

  it('infers the period from the page-1 statement date', () => {
    expect(period).toEqual({ from: '2026-08-01', to: '2026-09-15' });
  });

  it('parses exactly the table rows with transaction dates', () => {
    expect(
      rows.map(({ date, description, amount, status }) => ({
        date,
        description,
        amount,
        status,
      }))
    ).toEqual([
      {
        date: '2026-08-30',
        description: 'SAMPLE MART SINGAPORE',
        amount: '45.60',
        status: 'candidate',
      },
      {
        date: '2026-09-09',
        description: 'CAFE EXAMPLE',
        amount: '12.30',
        status: 'candidate',
      },
      {
        date: '2026-09-11',
        description: 'PAYMENT VIA TESTBANK',
        amount: '',
        status: 'excluded',
      },
      {
        date: '2026-09-13',
        description: 'ONLINE SHOP EXAMPLE',
        amount: '1234.56',
        status: 'candidate',
      },
      {
        date: '2026-09-14',
        description: '5ample Servlce',
        amount: '78.90',
        status: 'candidate',
      },
    ]);
  });

  it('keeps the credit marker in the row source', () => {
    expect(rows[2].classification).toBe('other_credit');
    expect(rows[2].source[0].text).toMatch(/1,000\.00 CR$/);
  });

  it('yields nothing from page 2 and never reads the summary column', () => {
    expect(rows.every((row) => row.source[0].page === 1)).toBe(true);
    const text = rows.map((row) => row.source[0].text).join(' ');
    for (const noise of ['9,999.99', '8,888.88', '50.00', '5,000', 'Total'])
      expect(text).not.toContain(noise);
  });

  it('drops continuation lines, junk tokens and notice or address blocks', () => {
    expect(rows).toHaveLength(5);
    const text = rows.map((row) => row.source[0].text).join(' ');
    for (const junk of ['BEE', 'RECT', 'SG ', 'SAMPLE PERSON', 'examine'])
      expect(text).not.toContain(junk);
  });

  it('flags low-confidence rows from table tokens only', () => {
    expect(rows[0].confidence).toBe(92);
    expect(rows[3].confidence).toBe(30);
    expect(rows[3].status).toBe('candidate');
  });

  it('wraps December rows into the prior year on a January statement', () => {
    const jan = statement('10 Jan 2027', [
      line(495, [
        ['28', 60],
        ['Dec', 71],
        ['30', 101],
        ['Dec', 112],
        ['SAMPLE MART', 141],
        ['5.00', 349],
      ]),
      line(480, [
        ['02', 60],
        ['Jan', 71],
        ['03', 101],
        ['Jan', 112],
        ['CAFE EXAMPLE', 141],
        ['6.00', 349],
      ]),
    ]);
    expect(
      parseStatementLines(jan.lines, 'hsbc', jan.period).map((r) => r.date)
    ).toEqual(['2026-12-30', '2027-01-03']);
  });

  describe('reconciliation', () => {
    const blocks = statementTotalBlocks(lines, 'hsbc');

    it('exposes the Total Due line over every row', () => {
      expect(blocks).toHaveLength(1);
      expect(blocks[0].totalCents).toBe(37136);
      expect(blocks[0].rowIds).toEqual(rows.map((row) => row.id));
    });

    it('matches with credits reducing the total', () => {
      expect(reconcileStatement(rows, blocks)).toEqual({ status: 'matched' });
    });

    it('counts an excluded payment row but not a summary row', () => {
      const withSummary = rows.map((row, index) =>
        index === 2
          ? { ...row, classification: 'card_repayment' as const }
          : row
      );
      expect(reconcileStatement(withSummary, blocks).status).toBe('matched');
      const summary = rows.map((row, index) =>
        index === 0 ? { ...row, isSummary: true } : row
      );
      expect(reconcileStatement(summary, blocks).status).toBe('mismatch');
    });

    it('reports a mismatch when one row amount is altered', () => {
      const altered = rows.map((row, index) =>
        index === 1 ? { ...row, amount: '12.80' } : row
      );
      expect(reconcileStatement(altered, blocks)).toEqual({
        status: 'mismatch',
        mismatches: [
          { totalCents: 37136, parsedCents: 37186, differenceCents: 50 },
        ],
      });
    });
  });

  it('exposes no total when the Total Due line is missing', () => {
    const noTotal = ROWS.filter((_, index) => index !== ROWS.length - 1);
    const { lines: partial } = statement('15 Sep 2026', noTotal);
    expect(statementTotalBlocks(partial, 'hsbc')).toEqual([]);
  });
});

describe('HSBC identity discrimination', () => {
  const { lines, period } = statement();
  const asText = (texts: string[]): StatementLine[] =>
    texts.map((text, index) => ({ page: 1, line: index + 1, text }));

  it('is not claimed by the other layouts that share a header shape', () => {
    for (const layout of [uobLayout, dbsLayout, paylahLayout])
      expect(layout.detect(lines).size).toBe(0);
  });

  it('is rejected when another bank is selected', () => {
    for (const bank of ['uob', 'dbs', 'citibank', 'paylah'] as const)
      expect(() => parseStatementLines(lines, bank, period)).toThrow(
        /could not be identified/
      );
  });

  it('does not claim the other banks statements', () => {
    const others = [
      asText(['DBS TEST CARDS', 'DATE DESCRIPTION AMOUNT (S$)']),
      asText(['CITIBANK TEST', 'DATE DESCRIPTION AMOUNT (SGD)']),
      asText([
        'UOB TEST',
        'Post Trans Description of Transaction Transaction Amount Date Date SGD',
      ]),
      asText(['PayLah! Wallet', 'DATE DESCRIPTION AMOUNT']),
    ];
    for (const other of others) {
      expect(hsbcLayout.detect(other).size).toBe(0);
      expect(() =>
        parseStatementLines(
          [...other, { page: 1, line: 9, text: '01 SEP SAMPLE 1.00' }],
          'hsbc',
          period
        )
      ).toThrow(/could not be identified/);
    }
  });
});
