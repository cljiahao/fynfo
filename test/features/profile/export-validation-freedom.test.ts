import { reviewExportJson } from '@/features/profile/lib/export-validation';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(
  resolve('docs/audit/pdf-import-fixtures/export-v3-synthetic.json'),
  'utf8'
);

function reviewWithPlanner(extra: Record<string, unknown>) {
  const file = JSON.parse(fixture) as {
    data: { plannerSettings: Record<string, unknown> | null };
  };
  file.data.plannerSettings = {
    ...(file.data.plannerSettings ?? {}),
    ...extra,
  };
  return reviewExportJson(JSON.stringify(file));
}

describe('freedom assumptions in exports', () => {
  it('accepts the optional freedom fields and files without them', () => {
    expect(
      reviewWithPlanner({
        freedomRealReturnPct: 4.5,
        freedomWithdrawalRatePct: 3.5,
        freedomTargetYear: 2045,
      }).ok
    ).toBe(true);
    expect(reviewWithPlanner({}).ok).toBe(true);
  });

  it.each([
    ['freedomRealReturnPct', -1],
    ['freedomRealReturnPct', 13],
    ['freedomWithdrawalRatePct', 0],
    ['freedomWithdrawalRatePct', 11],
    ['freedomTargetYear', 1999],
    ['freedomTargetYear', 2201],
    ['freedomTargetYear', 2040.5],
  ])('rejects %s = %s', (field, value) => {
    expect(reviewWithPlanner({ [field]: value }).ok).toBe(false);
  });

  it('still rejects unknown planner keys', () => {
    expect(reviewWithPlanner({ freedomUnknown: 1 }).ok).toBe(false);
  });
});
