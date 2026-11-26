import { goalMemberIds, goalPctsFor } from '../split-utils';

type PctMap = Record<string, number>;

export interface CommitmentSplit {
  members: PctMap;
  goalOverrides: Record<string, PctMap>;
  budgetOverrides: Record<string, PctMap>;
}

const DEFAULT_PCT = 50;

function pctToFraction(map: PctMap | undefined, userId: string): number | null {
  const pct = map?.[userId];
  return typeof pct === 'number' ? pct / 100 : null;
}

/** Caller's fraction of the household default split. */
export function defaultShare(split: CommitmentSplit, userId: string): number {
  return pctToFraction(split.members, userId) ?? DEFAULT_PCT / 100;
}

/**
 * Caller's fraction of one goal. A goal's members carry it: a stored override
 * wins while it covers exactly those members, otherwise the share is even
 * across them. A goal with no membership
 * rows covers the whole household, and a member who is not on the goal
 * carries nothing for it.
 */
export function goalShare(
  split: CommitmentSplit,
  goalId: string,
  userId: string,
  goalMembers: readonly string[] = []
): number {
  const members = goalMemberIds(Object.keys(split.members), goalMembers);
  if (!members.includes(userId)) return 0;
  const pcts = goalPctsFor(split.goalOverrides[goalId], members);
  return (pcts[userId] ?? 0) / 100;
}

/** Caller's fraction of one budget: its override when present, else the default. */
export function budgetShare(
  split: CommitmentSplit,
  budgetId: string,
  userId: string
): number {
  return (
    pctToFraction(split.budgetOverrides[budgetId], userId) ??
    defaultShare(split, userId)
  );
}
