import type { ReliefItem } from '../components/salary-summary';
import { RELIEF_CATALOG } from '../constants';
import type { TaxReliefData } from '../types';

export interface ReliefState {
  enabled: boolean;
  amount: number;
  count: number;
  variant: string;
}

export type ReliefStateMap = Map<string, ReliefState>;

/**
 * Seeds the per-relief editor state from the saved entries. For count-based
 * reliefs the saved amount is divided back out by the per-unit default; for
 * variant-based reliefs the matching variant is recovered from the amount.
 */
export function buildInitialState(
  saved: TaxReliefData[] | null
): ReliefStateMap {
  const map = new Map<string, ReliefState>();
  for (const def of RELIEF_CATALOG) {
    const match = saved?.find((r) => r.reliefKey === def.key);
    const savedAmount = match?.amount ?? 0;

    let count = 1;
    let variant = def.variants?.[0]?.value ?? '';

    if (match) {
      if (def.maxCount) {
        count = Math.max(Math.round(savedAmount / def.defaultAmount), 1);
      }
      if (def.variants) {
        const matched = def.variants.find((v) => v.amount === savedAmount);
        variant = matched?.value ?? def.variants[0]?.value ?? '';
      }
    }

    map.set(def.key, {
      enabled: !!match,
      amount: match ? savedAmount : def.defaultAmount,
      count,
      variant,
    });
  }
  return map;
}

/** The enabled reliefs as labelled line-items (count / variant decorate the label). */
export function buildReliefItems(state: ReliefStateMap): ReliefItem[] {
  const items: ReliefItem[] = [];
  for (const def of RELIEF_CATALOG) {
    const s = state.get(def.key);
    if (!s?.enabled) continue;

    let label = def.label;
    if (def.maxCount && s.count > 1) {
      label = `${def.label} (×${s.count})`;
    }
    if (def.variants) {
      const matched = def.variants.find((v) => v.value === s.variant);
      if (matched) label = `${def.label} — ${matched.label}`;
    }

    items.push({ label, amount: s.amount });
  }
  return items;
}

/** Sum of enabled relief amounts. */
export function computeTotal(state: ReliefStateMap): number {
  let total = 0;
  state.forEach((v) => {
    if (v.enabled) total += v.amount;
  });
  return total;
}
