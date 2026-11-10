import type { HouseholdGoal } from '../types';
import { goalCommitted } from './goal-stats';

export interface DraftItem {
  id?: string;
  name: string;
  budget: number;
  quote: number | null;
  dueDate?: string | null;
}

export interface DraftGoal {
  target: number;
  items: DraftItem[];
}

export interface GoalDelta {
  targetOld: number | null;
  targetNew: number;
  committedOld: number | null;
  committedNew: number;
  added: number;
  changed: number;
  removed: number;
  /** Names of removed rows that already have payments, which the delete takes with it. */
  removedWithPayments: string[];
}

/**
 * What saving the draft would change, for the confirm panel. Committed uses
 * the paid amount already recorded against a surviving row, matching the card.
 */
export function computeGoalDelta(
  goal: HouseholdGoal | undefined,
  draft: DraftGoal
): GoalDelta {
  const existing = new Map((goal?.items ?? []).map((item) => [item.id, item]));
  let added = 0;
  let changed = 0;
  let committedNew = 0;
  for (const item of draft.items) {
    const before = item.id ? existing.get(item.id) : undefined;
    if (!before) added += 1;
    else if (
      before.name !== item.name ||
      before.budget !== item.budget ||
      before.quote !== item.quote ||
      before.dueDate !== (item.dueDate ?? null)
    ) {
      changed += 1;
    }
    committedNew += Math.max(
      0,
      (item.quote ?? item.budget) - (before?.paid ?? 0)
    );
  }
  const kept = new Set(
    draft.items.flatMap((item) => (item.id ? [item.id] : []))
  );
  const removedRows = (goal?.items ?? []).filter((item) => !kept.has(item.id));
  return {
    targetOld: goal ? goal.targetAmount : null,
    targetNew: draft.target,
    committedOld: goal ? goalCommitted(goal) : null,
    committedNew,
    added,
    changed,
    removed: removedRows.length,
    removedWithPayments: removedRows
      .filter((item) => item.payments.length > 0)
      .map((item) => item.name),
  };
}
