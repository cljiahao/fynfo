'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteExpense,
  getDistinctPeople,
  getExpenses,
  settleMonthSplits,
  settleSplit,
  upsertExpense,
} from '../actions/expense-actions';
import type { ExpenseData } from '../types';

const EXPENSE_KEY = ['expenses'] as const;
const PEOPLE_KEY = ['expense-people'] as const;

export const useExpenses = () => {
  return useQuery({
    queryKey: EXPENSE_KEY,
    queryFn: () => getExpenses(),
  });
};

export const useUpsertExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseData) => upsertExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEY });
      queryClient.invalidateQueries({ queryKey: PEOPLE_KEY });
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEY });
    },
  });
};

export const useSettleSplit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      expenseId: string;
      person: string;
      settled: boolean;
    }) => settleSplit(data.expenseId, data.person, data.settled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEY });
    },
  });
};

export const useSettleMonthSplits = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      expenseIds: string[];
      person: string;
      settled: boolean;
    }) => settleMonthSplits(data.expenseIds, data.person, data.settled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEY });
    },
  });
};

export const useDistinctPeople = () => {
  return useQuery({
    queryKey: PEOPLE_KEY,
    queryFn: () => getDistinctPeople(),
  });
};
