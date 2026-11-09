import { OCR_CONFIDENCE_THRESHOLD } from '@/features/import-review/constants';
import {
  isLowConfidenceRow,
  reconcileStatement,
} from '@/features/import-review/lib/statement-guards';
import {
  parseStatementLines,
  positionedStatementLines,
  statementTotalBlocks,
} from '@/features/import-review/lib/statement-parser';
import type { PositionedStatementText } from '@/features/import-review/types';
import { describe, expect, it } from 'vitest';

const period = { from: '2026-10-01', to: '2026-10-31' };

function scanned(amountConfidence: number, others = 95) {
  const items: PositionedStatementText[] = [
    { text: 'UOB SGD billed', x: 40, y: 700, confidence: 99 },
    { text: '01 OCT', x: 40, y: 600, confidence: others },
    { text: 'MARKET', x: 120, y: 600, confidence: others },
    { text: '12.50', x: 500, y: 600, confidence: amountConfidence },
  ];
  return parseStatementLines(positionedStatementLines(items, 1), 'uob', period);
}

describe('OCR confidence on parsed rows', () => {
  it('takes the lowest word confidence across the row', () => {
    expect(scanned(62, 95)[0].confidence).toBe(62);
    expect(scanned(97, 71)[0].confidence).toBe(71);
  });

  it('flags 79 and does not flag 80', () => {
    expect(OCR_CONFIDENCE_THRESHOLD).toBe(80);
    expect(isLowConfidenceRow(scanned(79)[0])).toBe(true);
    expect(isLowConfidenceRow(scanned(80)[0])).toBe(false);
  });

  it('does not lower qualification: a flagged row keeps its status', () => {
    expect(scanned(10)[0].status).toBe(scanned(99)[0].status);
  });

  it('leaves text-layer rows without confidence and never flags them', () => {
    const lines = positionedStatementLines(
      [
        { text: 'UOB SGD billed', x: 40, y: 700 },
        { text: '01 OCT', x: 40, y: 600 },
        { text: 'MARKET', x: 120, y: 600 },
        { text: '12.50', x: 500, y: 600 },
      ],
      1
    );
    expect(lines.every((line) => !('confidence' in line))).toBe(true);
    const [row] = parseStatementLines(lines, 'uob', period);
    expect(row.confidence).toBeUndefined();
    expect(isLowConfidenceRow(row)).toBe(false);
  });
});

describe('reconcileStatement', () => {
  const base = scanned(90)[0];
  const rows = [
    { ...base, id: 'a', amount: '10.00' },
    { ...base, id: 'b', amount: '5.25' },
  ];

  it('matches when parsed amounts equal the total', () => {
    expect(
      reconcileStatement(rows, [{ totalCents: 1525, rowIds: ['a', 'b'] }])
    ).toEqual({ status: 'matched' });
  });

  it('reports the difference when they differ', () => {
    expect(
      reconcileStatement(rows, [{ totalCents: 1625, rowIds: ['a', 'b'] }])
    ).toEqual({
      status: 'mismatch',
      mismatches: [
        { totalCents: 1625, parsedCents: 1525, differenceCents: -100 },
      ],
    });
  });

  it('says unchecked when the layout supplies no total', () => {
    expect(reconcileStatement(rows, [])).toEqual({ status: 'unchecked' });
  });

  it('does nothing for text-layer rows', () => {
    const { confidence: _scanned, ...plain } = scanned(90)[0];
    const text = [{ ...plain, id: 'a', amount: '10.00' }];
    expect(
      reconcileStatement(text, [{ totalCents: 1, rowIds: ['a'] }])
    ).toEqual({ status: 'not_ocr' });
  });

  it('existing layouts expose no totals', () => {
    for (const bank of ['uob', 'dbs', 'citibank', 'paylah'] as const)
      expect(statementTotalBlocks([], bank)).toEqual([]);
  });
});
