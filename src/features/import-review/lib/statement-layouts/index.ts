import type { StatementBank } from '../../types';
import { dbsLayout } from './dbs';
import type { StatementLayout } from './types';
import { uobLayout } from './uob';

const LAYOUTS: Partial<Record<StatementBank, StatementLayout>> = {
  uob: uobLayout,
  dbs: dbsLayout,
};

export function getStatementLayout(
  bank: StatementBank
): StatementLayout | undefined {
  return LAYOUTS[bank];
}
