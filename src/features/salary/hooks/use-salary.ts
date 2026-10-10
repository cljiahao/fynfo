'use client';

import { useOverviewReadTransport } from '@/lib/overview-read-context';
import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSalaryRecord,
  getSalaryRecord,
  getSalaryRecords,
  upsertSalaryRecord,
} from '../actions/salary-actions';
import { SALARY_KEY } from '../constants';
import type { SalaryData } from '../types';

export { SALARY_KEY } from '../constants';

export function useSalaryRecords() {
  const transport = useOverviewReadTransport();
  return useQuery({
    queryKey: SALARY_KEY,
    queryFn: transport
      ? ({ signal }) => transport.read('salary', signal)
      : () => getSalaryRecords(),
  });
}

export function useSalaryRecord(id: string) {
  return useQuery({
    queryKey: [...SALARY_KEY, id],
    queryFn: () => getSalaryRecord(id),
    enabled: !!id,
  });
}

export function useUpsertSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SalaryData) => upsertSalaryRecord(data),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, SALARY_KEY);
    },
  });
}

export function useDeleteSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSalaryRecord(id),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, SALARY_KEY);
    },
  });
}
