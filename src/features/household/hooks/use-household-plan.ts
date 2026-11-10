'use client';

import { useQuery } from '@tanstack/react-query';
import { getHouseholdPlanInput } from '../actions/plan-actions';
import { PLANNER_COMMITMENT_KEY } from './use-planner-commitment';

/**
 * Under the commitment key prefix so the existing goal, split and budget
 * invalidations refresh it. It never blocks rendering: callers treat loading
 * and failure as "no plan".
 */
export function useHouseholdPlan() {
  return useQuery({
    queryKey: [...PLANNER_COMMITMENT_KEY, 'plan-input'],
    queryFn: getHouseholdPlanInput,
    retry: false,
  });
}
