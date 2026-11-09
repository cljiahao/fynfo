import { OCR_CONFIDENCE_THRESHOLD } from '../constants';
import type { StatementCandidate, StatementTotalBlock } from '../types';

/** Whether an OCR row is too uncertain to import without a manual check. Text
 * rows carry no confidence and are never flagged. */
export function isLowConfidenceRow(
  row: Pick<StatementCandidate, 'confidence'>
): boolean {
  return (
    row.confidence !== undefined && row.confidence < OCR_CONFIDENCE_THRESHOLD
  );
}

export type StatementReconciliation =
  | { status: 'not_ocr' }
  | { status: 'unchecked' }
  | { status: 'matched' }
  | {
      status: 'mismatch';
      mismatches: {
        totalCents: number;
        parsedCents: number;
        differenceCents: number;
      }[];
    };

function amountCents(amount: string): number {
  return amount ? Math.round(Number(amount.replaceAll(',', '')) * 100) : 0;
}

/**
 * Compares parsed amounts with the statement's own totals. Only OCR rows are
 * checked, since a text layer cannot misread a digit. Rows without an amount
 * count as zero, so an unreadable row surfaces as a mismatch instead of hiding.
 */
export function reconcileStatement(
  rows: readonly StatementCandidate[],
  blocks: readonly StatementTotalBlock[]
): StatementReconciliation {
  if (!rows.some((row) => row.confidence !== undefined))
    return { status: 'not_ocr' };
  if (!blocks.length) return { status: 'unchecked' };
  const byId = new Map(rows.map((row) => [row.id, row]));
  const mismatches = blocks.flatMap((block) => {
    const parsedCents = block.rowIds.reduce(
      (sum, id) => sum + amountCents(byId.get(id)?.amount ?? ''),
      0
    );
    return parsedCents === block.totalCents
      ? []
      : [
          {
            totalCents: block.totalCents,
            parsedCents,
            differenceCents: parsedCents - block.totalCents,
          },
        ];
  });
  return mismatches.length
    ? { status: 'mismatch', mismatches }
    : { status: 'matched' };
}
