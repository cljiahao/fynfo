'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDividend,
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
      queryClient.invalidateQueries({ queryKey: DIVIDENDS_KEY });
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
      queryClient.invalidateQueries({ queryKey: DIVIDENDS_KEY });
    },
  });
}

export function useDeleteDividend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDividend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIVIDENDS_KEY });
    },
  });
}
