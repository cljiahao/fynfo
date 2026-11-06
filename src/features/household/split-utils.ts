import type { PlannerSplit } from './types';

/** Whole-number percent from a text field, or null when it is not 0 to 100. */
export function parsePct(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

export function partnerIdOf(split: PlannerSplit): string | null {
  return Object.keys(split.members).find((id) => id !== split.userId) ?? null;
}

/** Caller's percent for an item: its override when present, else the default. */
export function myPctFor(
  split: PlannerSplit,
  override: Record<string, number> | undefined
): number {
  return override?.[split.userId] ?? split.members[split.userId] ?? 50;
}

/** A two-member override for the caller's percent, or null with no partner. */
export function overrideFor(
  split: PlannerSplit,
  pct: number
): Record<string, number> | null {
  const partnerId = partnerIdOf(split);
  return partnerId ? { [split.userId]: pct, [partnerId]: 100 - pct } : null;
}
