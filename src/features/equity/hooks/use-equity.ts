'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTrade,
  deleteTrade,
  getTrades,
  updateTrade,
} from '../actions/equity-actions';
import type { EquityTradeData } from '../types';

export const TRADES_KEY = ['equity-trades'] as const;

export function useTrades() {
  return useQuery({
    queryKey: TRADES_KEY,
    queryFn: () => getTrades(),
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EquityTradeData, 'id'>) => createTrade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_KEY });
    },
  });
}

export function useUpdateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Omit<EquityTradeData, 'id'>;
    }) => updateTrade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_KEY });
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_KEY });
    },
  });
}
