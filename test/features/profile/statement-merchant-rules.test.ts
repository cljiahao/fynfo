import { applyRulesToStatement } from '@/features/import-review/lib/merchant-rules';
import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
import type { MerchantRule } from '@/features/merchant-rules/types';
import { expect, it } from 'vitest';

const rule: MerchantRule = {
  id: '851af27a-e752-4aa5-8294-44b02bd911ca',
  label: 'Market',
  enabled: true,
  matchMode: 'phrase',
  matchText: 'MARKET',
  bank: 'uob',
  displayName: 'Market',
  category: 'groceries',
};
function rows() {
  return parseStatementLines(
    [
      'UOB SGD billed',
      '01 OCT MARKET NORTH 12.30',
      '02 OCT MARKET SOUTH 15.00',
    ].map((text, index) => ({ page: 1, line: index + 1, text })),
    'uob',
    { from: '2026-10-01', to: '2026-10-31' }
  );
}
it('fills all matches using original text and becomes a stable no-op', () => {
  const source = rows();
  const result = applyRulesToStatement(source, 'uob', [rule], () => false);
  expect(result.map((row) => [row.description, row.category])).toEqual([
    ['Market', 'groceries'],
    ['Market', 'groceries'],
  ]);
  expect(result[0].originalDescription).toBe('MARKET NORTH');
  expect(applyRulesToStatement(result, 'uob', [rule], () => false)).toBe(
    result
  );
  expect(source[0].description).toBe('MARKET NORTH');
});
it('preserves per-field manual choices, summaries and frozen attempts', () => {
  const source = rows();
  source[0] = {
    ...source[0],
    description: '',
    manualMerchant: { description: true, category: false },
  };
  const result = applyRulesToStatement(
    source,
    'uob',
    [rule],
    (id) => id === source[1].id
  );
  expect(result[0].description).toBe('');
  expect(result[0].category).toBe('groceries');
  expect(result[1]).toBe(source[1]);
  result[0].manualMerchant.category = true;
  expect(
    applyRulesToStatement(
      result,
      'uob',
      [{ ...rule, category: 'other' }],
      () => true
    )
  ).toBe(result);
  source[0].isSummary = true;
  expect(
    applyRulesToStatement(source, 'uob', [rule], (id) => id === source[1].id)
  ).toBe(source);
});
it('does not guess conflicts or apply paused or other-bank rules', () => {
  const source = rows();
  for (const rules of [
    [{ ...rule, enabled: false }],
    [{ ...rule, bank: 'dbs' as const }],
    [
      rule,
      {
        ...rule,
        id: 'ff65feb2-8ffa-427c-a057-8779580f162f',
        category: 'other' as const,
      },
    ],
  ]) {
    expect(applyRulesToStatement(source, 'uob', rules, () => false)).toBe(
      source
    );
  }
});
