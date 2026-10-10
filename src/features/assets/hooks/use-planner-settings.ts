'use client';

import { useOverviewReadTransport } from '@/lib/overview-read-context';
import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPlannerSettings,
  upsertPlannerSettings,
} from '../actions/planner-actions';
import { PLANNER_KEY } from '../constants';
import type { PlannerSettingsData } from '../types';

export { PLANNER_KEY } from '../constants';

export function usePlannerSettings() {
  const transport = useOverviewReadTransport();
  return useQuery({
    queryKey: PLANNER_KEY,
    queryFn: transport
      ? ({ signal }) => transport.read('planner', signal)
      : () => getPlannerSettings(),
  });
}

export function useUpsertPlannerSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlannerSettingsData) => upsertPlannerSettings(data),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, PLANNER_KEY);
    },
  });
}
