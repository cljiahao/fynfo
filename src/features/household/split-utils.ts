import type { PlannerSplit } from './types';

/** Whole-number percent from a text field, or null when it is not 0 to 100. */
export function parsePct(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
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
 * Percent per member for a goal: its stored override while it covers exactly
 * the goal's current members, else an even share across them. A member who
 * joined or left makes the stored map stale, and a stale map would give the
 * joiner nothing or leave a leaver's share unassigned.
 */
export function goalPctsFor(
  override: Record<string, number> | undefined,
  memberIds: readonly string[]
): Record<string, number> {
  const current =
    override !== undefined &&
    Object.keys(override).length === memberIds.length &&
    memberIds.every((id) => id in override);
  return current ? override : distributePct(memberIds);
}

/** Percent per member as typed in the form; a missing member reads as 0. */
export type PctText = Record<string, string>;

export function pctMapToText(
  map: Record<string, number>,
  ids: readonly string[]
): PctText {
  return Object.fromEntries(ids.map((id) => [id, String(map[id] ?? 0)]));
}

/** Points still unassigned across `ids`; negative when over-allocated. */
export function pctRemainder(text: PctText, ids: readonly string[]): number {
  return (
    100 - ids.reduce((sum, id) => sum + (parsePct(text[id] ?? '') ?? 0), 0)
  );
}

/**
 * The typed percentages as numbers once every member has a valid whole
 * percent and the total is exactly 100; otherwise null so saving stays off.
 */
export function parsePctMap(
  text: PctText,
  ids: readonly string[]
): Record<string, number> | null {
  const entries: [string, number][] = [];
  for (const id of ids) {
    const pct = parsePct(text[id] ?? '');
    if (pct === null) return null;
    entries.push([id, pct]);
  }
  return entries.reduce((sum, [, pct]) => sum + pct, 0) === 100
    ? Object.fromEntries(entries)
    : null;
}

/**
 * Starting split for a new goal: the household default when it covers exactly
 * the goal's members, otherwise an even share across them.
 */
export function seedPctsFor(
  split: PlannerSplit,
  memberIds: readonly string[]
): Record<string, number> {
  const stored = Object.keys(split.members);
  const same =
    !split.isDefault &&
    stored.length === memberIds.length &&
    memberIds.every((id) => id in split.members);
  return same ? split.members : distributePct(memberIds);
}
