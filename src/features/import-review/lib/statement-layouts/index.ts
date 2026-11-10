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

export function getStatementLayout(
  bank: StatementBank
): StatementLayout | undefined {
  return LAYOUTS[bank];
}
