import { SCENARIO_SLICES } from '../constants';
import type { SalaryPlan } from './salary-plan';

/** Scenario persistence and presentation must qualify the displayed percentages too. */
export function isScenarioPlanFinite(plan: SalaryPlan): boolean {
  return (
    Object.values(plan).every(
      (value) => typeof value !== 'number' || Number.isFinite(value)
    ) &&
    SCENARIO_SLICES.every(
      (slice) =>
        Number.isFinite(plan[slice.percent] * 100) &&
        Number.isFinite(
          plan.netAfterCpf > 0
            ? (plan[slice.amount] / plan.netAfterCpf) * 100
            : 0
        )
    )
  );
}
