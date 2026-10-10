'use server';

import { getPlannerSettings, getSnapshots } from '@/features/assets';
import { getTrades } from '@/features/equity';
import { getExpenses } from '@/features/expenses';
import { getSalaryRecords } from '@/features/salary';
import { requireActionContext } from '@/lib/action-guard';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { overviewSourcesSchema } from '../schemas';
import type { OverviewReadBundle, OverviewReadOutcome } from '../types';

function readOutcome<T>(
  read: () => Promise<T>
): Promise<OverviewReadOutcome<T>> {
  return Promise.resolve()
    .then(read)
    .then(
      (data) => ({ ok: true, data }),
      () => ({ ok: false, code: 'UNAVAILABLE' })
    );
}

export async function getOverviewReads(
  input: unknown
): Promise<OverviewReadBundle> {
  await requireActionContext();
  const sources = parseOrThrow(
    overviewSourcesSchema,
    input,
    'overview.sources'
  );
  const bundle: OverviewReadBundle = {};
  for (const source of sources) {
    switch (source) {
      case 'snapshots':
        bundle.snapshots = readOutcome(getSnapshots);
        break;
      case 'salary':
        bundle.salary = readOutcome(getSalaryRecords);
        break;
      case 'planner':
        bundle.planner = readOutcome(getPlannerSettings);
        break;
      case 'expenses':
        bundle.expenses = readOutcome(getExpenses);
        break;
      case 'trades':
        bundle.trades = readOutcome(getTrades);
    }
  }
  return bundle;
}
