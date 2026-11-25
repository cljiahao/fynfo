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

/**
 * Splits `total` whole percent across `ids` as evenly as integers allow.
 * Largest-remainder rounding: every id gets the floor and the leftover points
 * go to the earliest ids, so the result always sums to `total`.
 */
export function distributePct(
  ids: readonly string[],
  total = 100
): Record<string, number> {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return {};
  const base = Math.floor(total / unique.length);
  const extra = total - base * unique.length;
  return Object.fromEntries(
    unique.map((id, index) => [id, base + (index < extra ? 1 : 0)])
  );
}

/**
 * The members a goal is shared by. A goal with no membership rows predates
 * goal membership and covers the whole household.
 */
export function goalMemberIds(
  householdMemberIds: readonly string[],
  goalMembers: readonly string[] | undefined
): string[] {
  return goalMembers && goalMembers.length > 0
    ? [...goalMembers]
    : [...householdMemberIds];
}

/**
 * Percent per member for a goal: its stored override when present, else an
 * even share across the goal's members.
 */
export function goalPctsFor(
  override: Record<string, number> | undefined,
  memberIds: readonly string[]
): Record<string, number> {
  return override ?? distributePct(memberIds);
}

/** Caller's percent for an item: its override when present, else the default. */
export function myPctFor(
  split: PlannerSplit,
  override: Record<string, number> | undefined
): number {
  return override?.[split.userId] ?? split.members[split.userId] ?? 50;
}

/**
 * An override for the caller's percent across `memberIds` (the household when
 * omitted); the other members share the remainder evenly. Null when the
 * caller has nobody to split with.
 */
export function overrideFor(
  split: PlannerSplit,
  pct: number,
  memberIds: readonly string[] = Object.keys(split.members)
): Record<string, number> | null {
  const others = memberIds.filter((id) => id !== split.userId);
  if (others.length === 0) return null;
  return { [split.userId]: pct, ...distributePct(others, 100 - pct) };
}
