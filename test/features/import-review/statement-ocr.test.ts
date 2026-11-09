import { OCR_MIN_TEXT_ITEMS } from '@/features/import-review/constants';
import { ocrStatementPages } from '@/features/import-review/lib/statement-ocr';
import {
  needsOcr,
  ocrWordsToItems,
} from '@/features/import-review/lib/statement-ocr-items';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import {
  OCR_ASSETS,
  OCR_VERSION,
} from '../../../scripts/ocr-asset-manifest.mjs';

const word = (
  text: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) => ({
  text,
  confidence: 91,
  bbox: { x0, y0, x1, y1 },
});

it('routes sparse text layers to OCR only below the threshold', () => {
  expect(needsOcr(0)).toBe(true);
  expect(needsOcr(OCR_MIN_TEXT_ITEMS - 1)).toBe(true);
  expect(needsOcr(OCR_MIN_TEXT_ITEMS)).toBe(false);
});

it('converts canvas pixels to PDF points and keeps confidence', () => {
  expect(ocrWordsToItems([word(' SGD ', 200, 100, 300, 140)], 2, 800)).toEqual([
    { text: 'SGD', x: 100, y: 730, height: 20, confidence: 91 },
  ]);
});

it('drops blank and non-finite words and rejects an invalid scale', () => {
  const words = [word('  ', 0, 0, 1, 1), word('x', Number.NaN, 0, 1, 1)];
  expect(ocrWordsToItems(words, 2, 800)).toEqual([]);
  expect(ocrWordsToItems([word('a', 0, 0, 1, 1)], 0, 800)).toEqual([]);
});

function stubCanvas() {
  return { width: 100 } as unknown as HTMLCanvasElement;
}

it('recognises pages in order, reports progress and releases each canvas', async () => {
  const canvases: HTMLCanvasElement[] = [];
  const recognize = vi.fn(async () => [word('A', 0, 0, 10, 10)]);
  const onProgress = vi.fn();
  const pages = await ocrStatementPages({
    pageCount: 2,
    renderPage: async () => {
      const canvas = stubCanvas();
      canvases.push(canvas);
      return { canvas, scale: 1, heightPoints: 100 };
    },
    recognizer: { recognize, terminate: vi.fn() },
    isActive: () => true,
    onProgress,
  });
  expect(pages).toHaveLength(2);
  expect(onProgress.mock.calls).toEqual([
    [1, 2],
    [2, 2],
  ]);
  expect(canvases.map((canvas) => canvas.width)).toEqual([0, 0]);
});

it('stops when the review is no longer active', async () => {
  const recognize = vi.fn(async () => []);
  await expect(
    ocrStatementPages({
      pageCount: 3,
      renderPage: async () => ({
        canvas: stubCanvas(),
        scale: 1,
        heightPoints: 100,
      }),
      recognizer: { recognize, terminate: vi.fn() },
      isActive: () => false,
    })
  ).rejects.toThrow('Cancelled');
  expect(recognize).not.toHaveBeenCalled();
});

it('lists the self-hosted worker, LSTM cores and model', () => {
  const destinations = OCR_ASSETS.map((asset) => asset.destination);
  expect(OCR_VERSION).toBe('7.0.0');
  expect(destinations).toEqual(
    expect.arrayContaining([
      'worker.js',
      'core/tesseract-core-lstm.wasm.js',
      'core/tesseract-core-simd-lstm.wasm.js',
      'core/tesseract-core-relaxedsimd-lstm.wasm.js',
      'lang/eng.traineddata.gz',
    ])
  );
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs)$/.test(name) ? [full] : [];
  });
}

it('never references a CDN OCR URL', () => {
  const pattern = /jsdelivr|unpkg|cdnjs|tessdata\.projectnaptha/i;
  const offenders = sourceFiles('src').filter((file) =>
    pattern.test(readFileSync(file, 'utf8'))
  );
  expect(offenders).toEqual([]);
});
