'use client';

import { useOverviewReadTransport } from '@/lib/overview-read-context';
import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTrade,
  deleteTrade,
  getTrades,
  updateTrade,
} from '../actions/equity-actions';
import type { EquityTradeData } from '../types';

const TRADES_KEY = ['equity-trades'] as const;

export function useTrades() {
  const transport = useOverviewReadTransport();
  return useQuery({
    queryKey: TRADES_KEY,
    queryFn: transport
      ? ({ signal }) => transport.read('trades', signal)
      : () => getTrades(),
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EquityTradeData, 'id'>) => createTrade(data),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, TRADES_KEY);
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
      void refreshQueriesAfterMutation(queryClient, TRADES_KEY);
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrade(id),
    onSuccess: () => {
      void refreshQueriesAfterMutation(queryClient, TRADES_KEY);
    },
  });
}
