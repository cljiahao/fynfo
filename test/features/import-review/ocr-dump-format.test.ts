import {
  formatOcrDumpLines,
  formatOcrDumpWords,
  maskDigits,
  type OcrDumpPage,
} from '@/features/import-review/lib/ocr-dump-format';
import { expect, it } from 'vitest';

const page: OcrDumpPage = {
  page: 1,
  pxWidth: 2480,
  pxHeight: 3508,
  widthPoints: 595,
  heightPoints: 842,
  items: [
    { text: '1234.50', x: 300.25, y: 700, height: 9, confidence: 88 },
    { text: 'Item', x: 40, y: 700.5, height: 9, confidence: 95 },
    { text: 'Total', x: 40, y: 600, height: 9, confidence: 91 },
  ],
};

it('masks every digit and keeps other characters', () => {
  expect(maskDigits('12 Jan 4,500.25', true)).toBe('99 Jan 9,999.99');
  expect(maskDigits('12 Jan', false)).toBe('12 Jan');
});

it('formats one row per parser line in x order with min confidence', () => {
  const out = formatOcrDumpLines([page], false);
  expect(out.split('\n')).toEqual([
    '# page 1: 2480x3508px, 595.0x842.0pt',
    'y=700.5  40.0:Item 300.3:1234.50  min=88',
    'y=600.0  40.0:Total  min=91',
  ]);
});

it('masks text but never coordinates or confidences', () => {
  const out = formatOcrDumpLines([page], true);
  expect(out).toContain('300.3:9999.99');
  expect(out).toContain('min=88');
  expect(out).not.toMatch(/1234/);
  expect(formatOcrDumpWords([page], true)).toContain('9999.99\t300.3\t700.0');
});

it('marks a page with no words', () => {
  expect(formatOcrDumpLines([{ ...page, items: [] }], true)).toContain(
    '(no words)'
  );
});
