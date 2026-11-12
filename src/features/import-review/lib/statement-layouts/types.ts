import type { StatementLine } from '../../types';
import type { DetectedStatementPeriod } from '../statement-dates';

export interface StatementLayout {
  /** Pages whose transaction table this layout recognises. */
  detect(lines: StatementLine[]): Set<number>;
  /** Raw row groups (first line plus continuations) from claimed pages only. */
  groupRows(
    lines: StatementLine[],
    claimedPages: ReadonlySet<number>
  ): StatementLine[][];
  /**
   * Statement total or sub-total lines with the first line of each row they
   * cover. Layouts that omit this are reported as "total not checked" on OCR
   * imports.
   */
  blockTotals?(
    lines: StatementLine[],
    claimedPages: ReadonlySet<number>
  ): { totalCents: number; rowStarts: StatementLine[] }[];
  /**
   * Reads the statement date or period from this bank's own header shape.
   * Returns null when the header is absent or ambiguous; the generic labelled
   * detector then runs. The caller validates the result's bounds.
   */
  period?(lines: StatementLine[]): DetectedStatementPeriod | null;
  columns: {
    /** The single amount on a row is the billed SGD amount. */
    billedSgd: boolean;
    /** Rows start with a posting date followed by a transaction date. */
    twoDate: boolean;
  };
}
