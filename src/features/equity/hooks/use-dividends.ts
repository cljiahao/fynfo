'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDividend,
  createDividends,
  deleteDividend,
  getDividends,
  updateDividend,
} from '../actions/dividend-actions';
import type { DividendData } from '../types';

const DIVIDENDS_KEY = ['equity-dividends'] as const;

export function useDividends() {
  return useQuery({
    queryKey: DIVIDENDS_KEY,
    queryFn: () => getDividends(),
  });
}

export function useCreateDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<DividendData, 'id'>) => createDividend(data),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, DIVIDENDS_KEY);
    },
  });
}

export function useCreateDividends() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: Omit<DividendData, 'id'>[]) => createDividends(rows),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, DIVIDENDS_KEY);
    },
  });
}

export function useUpdateDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Omit<DividendData, 'id'>;
    }) => updateDividend(id, data),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, DIVIDENDS_KEY);
    },
  });
}

export function useDeleteDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDividend(id),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, DIVIDENDS_KEY);
    },
  });
}
