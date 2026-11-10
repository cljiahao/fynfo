import type { StatementBank } from '../../types';
import { citiLayout } from './citi';
import { dbsLayout } from './dbs';
import { hsbcLayout } from './hsbc';
import { paylahLayout } from './paylah';
import type { StatementLayout } from './types';
import { uobLayout } from './uob';

const LAYOUTS: Partial<Record<StatementBank, StatementLayout>> = {
  uob: uobLayout,
  dbs: dbsLayout,
  hsbc: hsbcLayout,
  citibank: citiLayout,
  paylah: paylahLayout,
};

/** Declared overlaps where two layouts can both claim one statement. The winner
 * is the more specific bank; there is deliberately no general priority order,
 * so any other double match stays ambiguous instead of being guessed. */
export const LAYOUT_PRECEDENCE: readonly {
  winner: StatementBank;
  loser: StatementBank;
}[] = [
  { winner: 'paylah', loser: 'dbs' },
  // The Citi header is a suffix of the HSBC header.
  { winner: 'hsbc', loser: 'citibank' },
];

export function getStatementLayout(
  bank: StatementBank
): StatementLayout | undefined {
  return LAYOUTS[bank];
}
