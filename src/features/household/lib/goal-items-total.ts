import type { HouseholdGoal } from '../types';

/** What the budget lines add up to, using the final quote where there is one. */
export function itemsTotal(items: HouseholdGoal['items']): number {
  return items.reduce((sum, item) => sum + (item.quote ?? item.budget), 0);
}
