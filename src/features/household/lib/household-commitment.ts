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

/** Caller's fraction of one goal: its override when present, else the default. */
export function goalShare(
  split: CommitmentSplit,
  goalId: string,
  userId: string
): number {
  return (
    pctToFraction(split.goalOverrides[goalId], userId) ??
    defaultShare(split, userId)
  );
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
