import { OCR_MIN_TEXT_ITEMS } from '../constants';
import type { PositionedStatementText } from '../types';

/** One recognised word in canvas pixels, y growing downward. */
export interface OcrWord {
  text: string;
  /** 0-100. */
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Whether a text layer is too sparse to parse, so the pages need OCR. */
export function needsOcr(textItemCount: number): boolean {
  return textItemCount < OCR_MIN_TEXT_ITEMS;
}

/**
 * Converts canvas pixels to PDF points so OCR words feed the same line
 * grouping as pdf.js text. pdf.js text `y` is a baseline growing upward, which
 * the bottom edge of the word box approximates.
 */
export function ocrWordsToItems(
  words: readonly OcrWord[],
  scale: number,
  pageHeightPoints: number
): PositionedStatementText[] {
  if (!Number.isFinite(scale) || scale <= 0) return [];
  return words.flatMap((word) => {
    const text = word.text.trim();
    const { x0, y0, x1, y1 } = word.bbox;
    if (!text || ![x0, y0, x1, y1].every(Number.isFinite)) return [];
    return [
      {
        text,
        x: x0 / scale,
        y: pageHeightPoints - y1 / scale,
        height: (y1 - y0) / scale,
        confidence: word.confidence,
      },
    ];
  });
}
