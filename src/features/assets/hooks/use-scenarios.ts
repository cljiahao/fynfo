'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createScenario,
  deleteScenario,
  getScenarios,
  updateScenario,
} from '../actions/scenario-actions';

const SCENARIOS_KEY = ['personal-planning-scenarios'] as const;
export function useScenarios(enabled: boolean) {
  return useQuery({
    queryKey: SCENARIOS_KEY,
    queryFn: () => getScenarios(),
    enabled,
  });
}
export function useScenarioMutations() {
  const client = useQueryClient();
  const refresh = () => {
    void refreshQueriesAfterMutation(client, SCENARIOS_KEY);
  };
  const create = useMutation({
    mutationFn: (input: unknown) => createScenario(input),
    onSuccess: (result) => {
      if (result.status === 'CREATED') refresh();
    },
  });
  const update = useMutation({
    mutationFn: (input: unknown) => updateScenario(input),
    onSuccess: (result) => {
      if (result.status === 'SAVED') refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (input: unknown) => deleteScenario(input),
    onSuccess: (result) => {
      if (result.status === 'DELETED') refresh();
    },
  });
  return { create, update, remove };
}
