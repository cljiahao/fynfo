'use client';

import { EmptyState } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { PiggyBank } from 'lucide-react';
import { ttmDistributionsSGD, yieldOnCost } from '../lib/dividend-metrics';
import { computeHoldings } from '../lib/holdings';
import type { DividendData, EquityTradeData } from '../types';

interface YieldOnCostTableProps {
  trades: EquityTradeData[];
  dividends: DividendData[];
  usdSgdRate: number;
  asOf: string; // ISO date
}

export function YieldOnCostTable({
  trades,
  dividends,
  usdSgdRate,
  asOf,
}: YieldOnCostTableProps) {
  const holdings = computeHoldings(trades);

  const rows = holdings
    .map((h) => {
      const ttm = ttmDistributionsSGD(dividends, h.ticker, usdSgdRate, asOf);
      return { ticker: h.ticker, ttm, yoc: yieldOnCost(ttm, h) };
    })
    .filter((r) => r.ttm > 0)
    .sort((a, b) => b.yoc - a.yoc);

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

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2 text-left font-medium">Ticker</th>
          <th className="py-2 text-right font-medium">Income (12m)</th>
          <th className="py-2 text-right font-medium">Yield on Cost</th>
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
