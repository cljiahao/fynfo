'use client';

import { format, parse } from 'date-fns';
import { useMemo } from 'react';
import { CATEGORIES, INVESTMENT_CATEGORIES } from '../constants';
import { calculateTotal } from '../lib/calculations';
import type { AssetCategory, ChartDataPoint, SnapshotData } from '../types';

function sumByCategory(
  entries: SnapshotData['entries'],
  category: AssetCategory
): number {
  return entries
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

function sumByCategories(
  entries: SnapshotData['entries'],
  categories: AssetCategory[]
): number {
  return entries
    .filter((e) => categories.includes(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function useChartData(
  snapshots: SnapshotData[] | undefined,
  maxMonths = 12
): ChartDataPoint[] {
  // useMemo justified: transforms full snapshot array into chart points on every render
  return useMemo(() => {
    if (!snapshots?.length) return [];

    const recent = snapshots.slice(-maxMonths);

    return recent.map((snapshot) => {
      const point: ChartDataPoint = {
        month: format(parse(snapshot.id, 'yyyy-MM', new Date()), 'MMM yyyy'),
        id: snapshot.id,
        savings: 0,
        bonds: 0,
        stocks: 0,
        etf: 0,
        non_equity: 0,
        crypto: 0,
        pension: 0,
        total: calculateTotal(snapshot.entries),
        total_investment: sumByCategories(
          snapshot.entries,
          INVESTMENT_CATEGORIES
        ),
        excl_pension: sumByCategories(
          snapshot.entries,
          CATEGORIES.filter((c) => c !== 'pension')
        ),
      };

      for (const cat of CATEGORIES) {
        point[cat] = sumByCategory(snapshot.entries, cat);
      }

      return point;
    });
  }, [snapshots, maxMonths]);
}
