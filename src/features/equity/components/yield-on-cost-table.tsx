'use client';

import { EmptyState } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { ArrowDown, ArrowUp, ArrowUpDown, PiggyBank } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ttmDistributionsSGD, yieldOnCost } from '../lib/dividend-metrics';
import { computeHoldings } from '../lib/holdings';
import type { DividendData, EquityTradeData } from '../types';

interface YieldOnCostTableProps {
  trades: EquityTradeData[];
  dividends: DividendData[];
  usdSgdRate: number;
  asOf: string; // ISO date
}

type SortKey = 'ticker' | 'income' | 'yield';
type SortDir = 'asc' | 'desc';

export function YieldOnCostTable({
  trades,
  dividends,
  usdSgdRate,
  asOf,
}: YieldOnCostTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('yield');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const rows = useMemo(() => {
    const base = computeHoldings(trades)
      .map((h) => {
        const ttm = ttmDistributionsSGD(dividends, h.ticker, usdSgdRate, asOf);
        return { ticker: h.ticker, ttm, yoc: yieldOnCost(ttm, h) };
      })
      .filter((r) => r.ttm > 0);

    const getValue = (r: (typeof base)[number]): string | number => {
      switch (sortKey) {
        case 'ticker':
          return r.ticker;
        case 'income':
          return r.ttm;
        case 'yield':
          return r.yoc;
      }
    };

    return base.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [trades, dividends, usdSgdRate, asOf, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="No yield-on-cost yet"
        description="Record distributions for tickers you still hold to see yield-on-cost."
        className="border-0"
      />
    );
  }

  const renderSortHeader = (
    label: string,
    col: SortKey,
    align: 'left' | 'right'
  ) => {
    const active = sortKey === col;
    return (
      <th
        className={`hover:text-foreground cursor-pointer py-2 font-medium select-none ${align === 'left' ? 'text-left' : 'text-right'}`}
        onClick={() => toggleSort(col)}
      >
        <span
          className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end' : ''}`}
        >
          {label}
          {active ? (
            sortDir === 'asc' ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : (
            <ArrowUpDown className="size-3 opacity-30" />
          )}
        </span>
      </th>
    );
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          {renderSortHeader('Ticker', 'ticker', 'left')}
          {renderSortHeader('Income (12m)', 'income', 'right')}
          {renderSortHeader('Yield on Cost', 'yield', 'right')}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ticker} className="border-b last:border-0">
            <td className="py-2 font-medium">{r.ticker}</td>
            <td className="py-2 text-right tabular-nums">{formatSGD(r.ttm)}</td>
            <td className="py-2 text-right font-semibold text-emerald-600 tabular-nums">
              {(r.yoc * 100).toFixed(2)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
