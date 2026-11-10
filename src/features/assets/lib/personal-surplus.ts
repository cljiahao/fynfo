import {
  DEFAULT_EMERGENCY_MONTHS,
  DEFAULT_WAR_CHEST_MONTHS,
} from '../constants';
import type { PlannerSettingsData, SnapshotData } from '../types';
import { computeSalaryPlan, sumByCategory } from './salary-plan';

export interface PersonalSurplusInput {
  /** Oldest first; the last element is the latest snapshot. */
  snapshots: readonly Pick<SnapshotData, 'entries'>[];
  /** Saved planner settings; null or undefined falls back to the defaults. */
  settings?: Pick<
    PlannerSettingsData,
    'emergencyMonths' | 'warChestMonths'
  > | null;
  /** Recent monthly expense average, rounded here like the planner does. */
  averageExpense: number;
  /** Per-browser expenses override; wins over the average when set. */
  override: number | null;
}

/**
 * Savings and bonds above the emergency fund and war chest, the same figure
 * the personal planner treats as spare. Null when there is no snapshot to
 * read, so callers never show a number from missing data.
 */
export function derivePersonalSurplus(
  input: PersonalSurplusInput
): number | null {
  const snapshot = input.snapshots.at(-1);
  if (!snapshot) return null;
  const plan = computeSalaryPlan({
    salary: 0,
    expenses: input.override ?? Math.round(input.averageExpense),
    emergencyMonths:
      input.settings?.emergencyMonths ?? DEFAULT_EMERGENCY_MONTHS,
    warChestMonths: input.settings?.warChestMonths ?? DEFAULT_WAR_CHEST_MONTHS,
    titheEnabled: false,
    tithePctInput: 0,
    allowanceEnabled: false,
    allowancePctInput: 0,
    currentSavings: sumByCategory(snapshot.entries, 'savings'),
    currentBonds: sumByCategory(snapshot.entries, 'bonds'),
  });
  return Math.max(0, plan.goalsFunded - plan.goalsNeeded);
}
