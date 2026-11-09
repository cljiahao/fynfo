import { OCR_MIN_TEXT_ITEMS } from '../constants';
import type { PositionedStatementText } from '../types';

/** One recognised word in canvas pixels, y growing downward. */
export interface OcrWord {
  text: string;
  /** 0-100. */
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Words the engine grouped onto one printed line. */
export interface OcrLine {
  words: OcrWord[];
}

/** Items with visible text; whitespace-only items say nothing about a page. */
export function countTextItems(items: readonly { text: string }[]): number {
  return items.filter((item) => item.text.trim()).length;
}

/**
 * Whether one page's text layer is too sparse to parse. A scan often keeps a
 * footer or watermark as text, so the decision is per page and tolerates a few
 * stray items.
 */
export function needsOcr(textItemCount: number): boolean {
  return textItemCount < OCR_MIN_TEXT_ITEMS;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Converts canvas pixels to PDF points so OCR words feed the same line
 * grouping as pdf.js text. pdf.js text `y` is a baseline growing upward. Each
 * recognised line gets one baseline (the median bottom of its words) so
 * descenders such as "g" or "p" cannot push a word off its line under the
 * parser's tight y grouping.
 *
 * Assumes an upright page whose view box starts at the origin: rotated pages
 * and a non-zero page.view origin are not handled yet.
 */
export function ocrLinesToItems(
  lines: readonly OcrLine[],
  scale: number,
  pageHeightPoints: number
): PositionedStatementText[] {
  if (!Number.isFinite(scale) || scale <= 0) return [];
  return lines.flatMap(({ words }) => {
    const valid = words.flatMap((word) => {
      const text = word.text.trim();
      const { x0, y0, x1, y1 } = word.bbox;
      return text && [x0, y0, x1, y1].every(Number.isFinite)
        ? [{ word, text }]
        : [];
    });
    if (!valid.length) return [];
    const baseline =
      pageHeightPoints - median(valid.map(({ word }) => word.bbox.y1)) / scale;
    return valid.map(({ word, text }) => ({
      text,
      x: word.bbox.x0 / scale,
      y: baseline,
      height: (word.bbox.y1 - word.bbox.y0) / scale,
      confidence: word.confidence,
    }));
  });
}
