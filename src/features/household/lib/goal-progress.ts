export interface GoalProgress {
  contributed: number;
  target: number;
  remaining: number;
  /** Whole-number percent, clamped to [0, 100]. */
  pct: number;
}

/**
 * Pure progress math for a household goal (spec 054). Extracted to a gated lib so
 * the sum / percent / remaining contract is unit-tested independent of the UI.
 */
export function computeGoalProgress(
  target: number,
  contributions: number[]
): GoalProgress {
  const contributed = contributions.reduce((sum, n) => sum + n, 0);
  const remaining = Math.max(0, target - contributed);
  const pct =
    target > 0 ? Math.min(100, Math.round((contributed / target) * 100)) : 0;
  return { contributed, target, remaining, pct };
}
