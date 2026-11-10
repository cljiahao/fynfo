import type { PositionedStatementText } from '../types';
import { groupPositionedText } from './statement-parser';

export interface OcrDumpPage {
  page: number;
  pxWidth: number;
  pxHeight: number;
  widthPoints: number;
  heightPoints: number;
  items: PositionedStatementText[];
}

/** The dump page exists only for local development; production serves 404. */
export function isOcrDumpEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}

/** Statement digits are the sensitive part, so masking keeps layout intact
 * (same character count) while hiding every amount, date and account number. */
export function maskDigits(text: string, mask: boolean): string {
  return mask ? text.replace(/\d/g, '9') : text;
}

function confidence(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(0) : '-';
}

function header(page: OcrDumpPage): string {
  return `# page ${page.page}: ${page.pxWidth}x${page.pxHeight}px, ${page.widthPoints.toFixed(1)}x${page.heightPoints.toFixed(1)}pt`;
}

/** One row per parser line, using the parser's own grouping and ordering. */
export function formatOcrDumpLines(
  pages: readonly OcrDumpPage[],
  mask: boolean
): string {
  return pages
    .map((page) => {
      const rows = groupPositionedText(page.items).map((line) => {
        const ordered = [...line.items].sort((a, b) => a.x - b.x);
        const words = ordered
          .map((item) => `${item.x.toFixed(1)}:${maskDigits(item.text, mask)}`)
          .join(' ');
        const scores = ordered.flatMap((item) =>
          typeof item.confidence === 'number' ? [item.confidence] : []
        );
        const lowest = scores.length ? Math.min(...scores) : undefined;
        return `y=${line.y.toFixed(1)}  ${words}  min=${confidence(lowest)}`;
      });
      return [header(page), ...(rows.length ? rows : ['(no words)'])].join(
        '\n'
      );
    })
    .join('\n\n');
}

/** Raw per-word table: text, x, y (points), height (points), confidence. */
export function formatOcrDumpWords(
  pages: readonly OcrDumpPage[],
  mask: boolean
): string {
  return pages
    .map((page) => {
      const rows = page.items.map((item) =>
        [
          maskDigits(item.text, mask),
          item.x.toFixed(1),
          item.y.toFixed(1),
          (item.height ?? 0).toFixed(1),
          confidence(item.confidence),
        ].join('\t')
      );
      return [header(page), 'text\tx\ty\theight\tconf', ...rows].join('\n');
    })
    .join('\n\n');
}
