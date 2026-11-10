import { STATEMENT_BANKS } from '@/features/import-review/constants';
import { detectStatementBank } from '@/features/import-review/lib/statement-bank-detect';
import * as layouts from '@/features/import-review/lib/statement-layouts';
import { positionedStatementLines } from '@/features/import-review/lib/statement-parser';
import type { StatementBank } from '@/features/import-review/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

const stubbed = vi.hoisted(() => ({
  banks: new Set<string>(),
}));

vi.mock('@/features/import-review/lib/statement-layouts', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/import-review/lib/statement-layouts')
  >('@/features/import-review/lib/statement-layouts');
  return {
    ...actual,
    getStatementLayout: (bank: StatementBank) =>
      stubbed.banks.has(bank)
        ? { detect: () => new Set([1]), groupRows: () => [], columns: {} }
        : actual.getStatementLayout(bank),
  };
});

afterEach(() => stubbed.banks.clear());

function lines(...text: string[]) {
  return text.map((value, index) => ({
    page: 1,
    line: index + 1,
    text: value,
  }));
}

const UOB = [
  'UOB',
  'Post Date Trans Date Description of Transaction Transaction Amount SGD',
];
const DBS = ['DBS TEST CARDS', 'DATE DESCRIPTION AMOUNT (S$)'];
const PAYLAH = [
  'PayLah! Statement',
  'DBS Bank Ltd',
  'STATEMENT DATE MOBILE NUMBER WALLET ACCOUNT',
  'DATE DESCRIPTION AMOUNT',
];
const HSBC = ['HSBC TEST CARDS', 'DATE DATE DESCRIPTION AMOUNT(SGD)'];
const CITI = ['CITIBANK TEST CARDS', 'DATE DESCRIPTION AMOUNT (SGD)'];

describe('detectStatementBank', () => {
  it.each([
    ['uob', UOB],
    ['dbs', DBS],
    ['paylah', PAYLAH],
    ['hsbc', HSBC],
    ['citibank', CITI],
  ] as const)('matches a %s statement', (bank, text) => {
    expect(detectStatementBank(lines(...text))).toEqual({
      status: 'match',
      bank,
    });
  });

  it('matches an HSBC statement read from positioned OCR words', () => {
    const word = (text: string, x: number, y: number) => ({
      text,
      x,
      y,
      confidence: 90,
    });
    const ocr = positionedStatementLines(
      [
        word('HSBC', 60, 700),
        word('TEST', 100, 700),
        word('DATE', 58, 540),
        word('DATE', 103, 540),
        word('DESCRIPTION', 142, 540),
        word('AMOUNT(SGD)', 280, 540),
      ],
      1
    );
    expect(ocr.every((line) => line.words)).toBe(true);
    expect(detectStatementBank(ocr)).toEqual({ status: 'match', bank: 'hsbc' });
  });

  it('resolves the HSBC and Citi header overlap to hsbc', () => {
    const text = lines('HSBC TEST CARDS', 'PAYMENT VIA CITI TEST', HSBC[1]);
    expect(detectStatementBank(text)).toEqual({
      status: 'match',
      bank: 'hsbc',
    });
  });

  it('keeps PayLah ahead of DBS when both layouts claim the lines', () => {
    stubbed.banks.add('paylah');
    stubbed.banks.add('dbs');
    expect(
      detectStatementBank(lines('PayLah! Statement', 'DBS Bank Ltd'))
    ).toEqual({
      status: 'match',
      bank: 'paylah',
    });
  });

  it('returns none when no bank is recognised', () => {
    expect(
      detectStatementBank(lines('SYNTHETIC TEST', 'NOTHING HERE'))
    ).toEqual({
      status: 'none',
    });
    expect(detectStatementBank([])).toEqual({ status: 'none' });
  });

  it('does not treat an identity without a layout header as a candidate', () => {
    expect(
      detectStatementBank(lines('UOB', 'DBS', 'HSBC', 'CITIBANK'))
    ).toEqual({
      status: 'none',
    });
  });

  it('does not treat a header without a matching identity as a candidate', () => {
    expect(detectStatementBank(lines('SYNTHETIC TEST', DBS[1]))).toEqual({
      status: 'none',
    });
  });

  it('reports an undeclared overlap as ambiguous in stable bank order', () => {
    const text = lines(...UOB, ...DBS);
    const expected = { status: 'ambiguous', banks: ['uob', 'dbs'] };
    expect(detectStatementBank(text)).toEqual(expected);
    expect(detectStatementBank(lines(...DBS, ...UOB))).toEqual(expected);
  });

  it('has a layout for every bank offered for auto-detection', () => {
    for (const entry of STATEMENT_BANKS)
      expect(layouts.getStatementLayout(entry.value)).toBeDefined();
  });
});
