import { RELIEF_CATALOG } from '@/features/salary/constants';
import {
  buildInitialState,
  buildReliefItems,
  computeTotal,
} from '@/features/salary/lib/tax-reliefs';
import type { TaxReliefData } from '@/features/salary/types';
import { describe, expect, it } from 'vitest';

const firstKey = RELIEF_CATALOG[0].key;
const countDef = RELIEF_CATALOG.find((d) => d.maxCount);
const variantDef = RELIEF_CATALOG.find((d) => d.variants && d.variants.length);

describe('buildInitialState', () => {
  it('disables every relief and uses defaults when nothing is saved', () => {
    const state = buildInitialState(null);
    expect(state.size).toBe(RELIEF_CATALOG.length);
    for (const def of RELIEF_CATALOG) {
      const s = state.get(def.key)!;
      expect(s.enabled).toBe(false);
      expect(s.amount).toBe(def.defaultAmount);
    }
  });

  it('enables and restores the saved amount for a saved relief', () => {
    const saved: TaxReliefData[] = [{ reliefKey: firstKey, amount: 1234 }];
    const s = buildInitialState(saved).get(firstKey)!;
    expect(s.enabled).toBe(true);
    expect(s.amount).toBe(1234);
  });

  it('recovers count for a count-based relief from the saved amount', () => {
    if (!countDef) return; // catalog has no count-based relief
    const saved: TaxReliefData[] = [
      { reliefKey: countDef.key, amount: countDef.defaultAmount * 3 },
    ];
    expect(buildInitialState(saved).get(countDef.key)!.count).toBe(3);
  });

  it('recovers the variant for a variant-based relief from the saved amount', () => {
    if (!variantDef?.variants) return;
    const v = variantDef.variants[variantDef.variants.length - 1];
    const saved: TaxReliefData[] = [
      { reliefKey: variantDef.key, amount: v.amount },
    ];
    expect(buildInitialState(saved).get(variantDef.key)!.variant).toBe(v.value);
  });
});

describe('computeTotal', () => {
  it('sums only enabled reliefs', () => {
    const state = buildInitialState(null);
    state.set('a', { enabled: true, amount: 100, count: 1, variant: '' });
    state.set('b', { enabled: false, amount: 999, count: 1, variant: '' });
    state.set('c', { enabled: true, amount: 50, count: 1, variant: '' });
    // base state from null is all-disabled, so only a + c count
    expect(computeTotal(state)).toBe(150);
  });
});

describe('buildReliefItems', () => {
  it('emits a line-item only for enabled reliefs', () => {
    const saved: TaxReliefData[] = [{ reliefKey: firstKey, amount: 500 }];
    const items = buildReliefItems(buildInitialState(saved));
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(500);
  });
});
