'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPlannerSettings,
  upsertPlannerSettings,
} from '../actions/planner-actions';
import type { PlannerSettingsData } from '../types';

const PLANNER_KEY = ['planner-settings'] as const;

export function usePlannerSettings() {
  return useQuery({
    queryKey: PLANNER_KEY,
    queryFn: () => getPlannerSettings(),
  });
}

export function useUpsertPlannerSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlannerSettingsData) => upsertPlannerSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANNER_KEY });
    },
  });
}
