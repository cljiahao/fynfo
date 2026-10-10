'use client';

import type { PlannerSettingsData, SnapshotRecord } from '@/features/assets';
import type { EquityTradeData } from '@/features/equity';
import type { ExpenseData } from '@/features/expenses';
import type { SalaryData } from '@/features/salary';
import { createContext, useContext } from 'react';

export interface OverviewReadData {
  snapshots: SnapshotRecord[];
  salary: SalaryData[];
  planner: PlannerSettingsData | null;
  expenses: ExpenseData[];
  trades: EquityTradeData[];
}
export type OverviewSource = keyof OverviewReadData;
export interface OverviewReadTransport {
  read<K extends OverviewSource>(
    source: K,
    signal: AbortSignal
  ): Promise<OverviewReadData[K]>;
}

export const OverviewReadContext = createContext<OverviewReadTransport | null>(
  null
);

export function useOverviewReadTransport() {
  return useContext(OverviewReadContext);
}
