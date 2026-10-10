'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTaxReliefs, upsertTaxReliefs } from '../actions/relief-actions';
import type { TaxReliefData } from '../types';

const RELIEF_KEY = ['tax-reliefs'] as const;

export function useTaxReliefs(year: number) {
  return useQuery({
    queryKey: [...RELIEF_KEY, year],
    queryFn: () => getTaxReliefs(year),
  });
}

export function useUpsertTaxReliefs(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reliefs: TaxReliefData[]) => upsertTaxReliefs(year, reliefs),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, [...RELIEF_KEY, year]);
    },
  });
}
