import {
  matchMerchantRules,
  normalizeMerchant,
} from '@/features/merchant-rules/lib/matching';
import type { MerchantRule } from '@/features/merchant-rules/types';
import { describe, expect, it } from 'vitest';

const base: MerchantRule = {
  id: '851af27a-e752-4aa5-8294-44b02bd911ca',
  label: 'Market',
  enabled: true,
  matchMode: 'phrase',
  matchText: 'market',
  bank: null,
  displayName: 'Market',
  category: 'groceries',
};
const otherId = 'ff65feb2-8ffa-427c-a057-8779580f162f';

describe('merchant comparison contract', () => {
  it('normalizes only comparison text and keeps composed accents', () => {
    expect(normalizeMerchant('  CAFE\u0301\t  北店 ')).toBe('café 北店');
    expect(normalizeMerchant('ＦＯＯ')).not.toBe(normalizeMerchant('foo'));
    expect(normalizeMerchant('café')).not.toBe(normalizeMerchant('cafe'));
  });
  it.each([
    'Market',
    'market branch',
    'LOCAL-MARKET',
    "LOCAL'MARKET",
    'market.market',
    '(MARKET)',
  ])('matches a full phrase boundary: %s', (description) => {
    expect(matchMerchantRules(description, 'uob', [base]).status).toBe(
      'suggestion'
    );
  });
  it.each([
    'supermarket',
    'marketplace',
    'market2',
    '2market',
    'market\u0301',
    '𐐀market',
    'market𐐀',
  ])('does not match within Unicode words: %s', (description) => {
    expect(matchMerchantRules(description, 'uob', [base]).status).toBe('none');
  });
  it('continues past an embedded occurrence to a later valid boundary', () => {
    expect(
      matchMerchantRules('supermarket / market', 'dbs', [base]).status
    ).toBe('suggestion');
  });
  it('compares non-Latin exact and phrase rules without inferred word segmentation', () => {
    const rule = { ...base, matchText: '市场' };
    expect(matchMerchantRules('市场 / 北店', 'uob', [rule]).status).toBe(
      'suggestion'
    );
    expect(matchMerchantRules('超级市场', 'uob', [rule]).status).toBe('none');
  });
  it('gives exact matches precedence, independent of ordering and conflicting broader outputs', () => {
    const exact: MerchantRule = {
      ...base,
      id: otherId,
      matchMode: 'exact',
      matchText: 'market north',
      category: 'shopping',
    };
    for (const rules of [
      [base, exact],
      [exact, base],
    ]) {
      expect(matchMerchantRules('MARKET  NORTH', 'uob', rules)).toMatchObject({
        status: 'suggestion',
        tier: 'exact',
        rules: [exact],
        suggestion: { category: 'shopping' },
      });
    }
  });
  it('filters disabled and wrong-bank exact rules before choosing a tier', () => {
    const exact: MerchantRule = {
      ...base,
      id: otherId,
      matchMode: 'exact',
      bank: 'dbs',
      category: 'shopping',
    };
    expect(matchMerchantRules('market', 'uob', [exact, base])).toMatchObject({
      tier: 'phrase',
      rules: [base],
    });
    expect(
      matchMerchantRules('market', 'dbs', [{ ...exact, enabled: false }, base])
    ).toMatchObject({ tier: 'phrase' });
  });
  it.each(['exact', 'phrase'] as const)(
    'requires review for any disagreement in the winning %s tier',
    (matchMode) => {
      const first = { ...base, matchMode };
      for (const change of [
        { category: null },
        { displayName: null },
        { displayName: 'MARKET' },
      ]) {
        expect(
          matchMerchantRules('market', 'uob', [
            first,
            { ...first, id: otherId, ...change },
          ])
        ).toMatchObject({
          status: 'conflict',
          tier: matchMode,
        });
      }
    }
  );
  it('reports all identical contributing rules without changing source or rules', () => {
    const rules = [base, { ...base, id: otherId, label: 'Equivalent' }];
    const before = JSON.stringify(rules);
    expect(matchMerchantRules('market', 'uob', rules)).toMatchObject({
      status: 'suggestion',
      rules,
    });
    expect(JSON.stringify(rules)).toBe(before);
  });
  it('does not treat empty or punctuation-only patterns as catch-all matches', () => {
    for (const matchText of ['', ' ', '---'])
      expect(
        matchMerchantRules('--- market', 'uob', [{ ...base, matchText }]).status
      ).toBe('none');
  });
});
