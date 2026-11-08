import type { StatementLine } from '../../types';

export interface StatementLayout {
  /** Pages whose transaction table this layout recognises. */
  detect(lines: StatementLine[]): Set<number>;
  /** Raw row groups (first line plus continuations) from claimed pages only. */
  groupRows(
    lines: StatementLine[],
    claimedPages: ReadonlySet<number>
  ): StatementLine[][];
  columns: {
    /** The single amount on a row is the billed SGD amount. */
    billedSgd: boolean;
    /** Rows start with a posting date followed by a transaction date. */
    twoDate: boolean;
  };
}
