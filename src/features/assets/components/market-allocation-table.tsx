'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import type { Holding } from '@/features/equity/lib/holdings';
import { formatCurrency } from '@/lib/utils/currency';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type SortKey = 'ticker' | 'current' | 'alloc' | 'target' | 'lacking' | 'shares';
type SortDir = 'asc' | 'desc';

export function MarketAllocationTable({
  title,
  holdings,
  prices,
  pricesLoading,
  allocations,
  onAllocationChange,
  currency,
  target,
  usdToSgd,
}: {
  title: string;
  holdings: Holding[];
  prices: Record<string, { price: number }> | undefined;
  pricesLoading: boolean;
  allocations: Record<string, number>;
  onAllocationChange: (ticker: string, pct: number) => void;
  currency: 'SGD' | 'USD';
  target: number;
  usdToSgd: number;
}) {
  const isSg = currency === 'SGD';

  // Target is in SGD from the breakdown. Convert to USD for US stocks.
  const targetInCurrency = isSg ? target : usdToSgd > 0 ? target / usdToSgd : 0;

  const totalPortfolioValue = holdings.reduce((s, h) => {
    const p = prices?.[h.ticker]?.price ?? 0;
    return s + h.shares * p;
  }, 0);

  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  // useMemo justified: computes derived row data (prices × shares, targets, lacking) for each holding
  const rows = useMemo(() => {
    return holdings.map((h) => {
      const price = prices?.[h.ticker]?.price ?? 0;
      const currentValue = h.shares * price;
      const alloc = allocations[h.ticker] ?? 0;
      const tickerTarget = targetInCurrency * (alloc / 100);
      const lacking = tickerTarget - currentValue;
      let sharesToBuy = 0;
      if (price > 0 && lacking > 0) {
        const raw = lacking / price;
        sharesToBuy = isSg ? Math.floor(raw / 100) * 100 : Math.floor(raw);
      }
      return {
        ticker: h.ticker,
        price,
        currentValue,
        alloc,
        tickerTarget,
        lacking,
        sharesToBuy,
      };
    });
  }, [holdings, prices, allocations, targetInCurrency, isSg]);

  // useMemo justified: re-sorts row array on sort key/direction change
  const sorted = useMemo(() => {
    const getValue = (r: (typeof rows)[number]) => {
      switch (sortKey) {
        case 'ticker':
          return r.ticker;
        case 'current':
          return r.currentValue;
        case 'alloc':
          return r.alloc;
        case 'target':
          return r.tickerTarget;
        case 'lacking':
          return r.lacking;
        case 'shares':
          return r.sharesToBuy;
      }
    };
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const totalAllocPct = rows.reduce((s, r) => s + r.alloc, 0);

  const renderSortHeader = (
    label: string,
    col: SortKey,
    align: 'left' | 'center' = 'center'
  ) => {
    const active = sortKey === col;
    return (
      <th
        key={col}
        className={`hover:text-foreground cursor-pointer py-2 font-medium select-none ${align === 'left' ? 'text-left' : 'text-center'}`}
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-0.5">
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
    <Accordion type="single" collapsible>
      <AccordionItem value={title} className="rounded-lg border">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex w-full items-center gap-3 text-sm">
            <span className="font-semibold">{title}</span>
            {pricesLoading && <Loader2 className="size-3 animate-spin" />}
          </div>
        </AccordionTrigger>
        <AccordionContent className="!px-0 pb-0">
          <div className="overflow-x-auto px-4 pb-4">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>
                <span className="text-muted-foreground">Holdings: </span>
                <span className="font-semibold">
                  {formatCurrency(totalPortfolioValue, currency)}
                </span>
              </span>
              {targetInCurrency > 0 && (
                <span>
                  <span className="text-muted-foreground">Target: </span>
                  <span className="font-semibold text-blue-500">
                    {formatCurrency(targetInCurrency, currency)}
                  </span>
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs">
                  {renderSortHeader('Ticker', 'ticker', 'left')}
                  {renderSortHeader('Current', 'current')}
                  {renderSortHeader('Alloc %', 'alloc')}
                  {renderSortHeader('Target', 'target')}
                  {renderSortHeader('Lacking', 'lacking')}
                  {renderSortHeader('Shares', 'shares')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.ticker} className="border-b last:border-0">
                    <td className="py-2 font-mono font-medium">{r.ticker}</td>
                    <td className="py-2 text-center">
                      {r.price > 0
                        ? formatCurrency(r.currentValue, currency)
                        : '-'}
                    </td>
                    <td className="py-2 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        className="mx-auto h-7 w-16 text-center text-xs"
                        value={r.alloc || ''}
                        placeholder="0"
                        onChange={(e) =>
                          onAllocationChange(
                            r.ticker,
                            Number(e.target.value) || 0
                          )
                        }
                      />
                    </td>
                    <td className="py-2 text-center">
                      {r.alloc > 0
                        ? formatCurrency(r.tickerTarget, currency)
                        : '-'}
                    </td>
                    <td
                      className={`py-2 text-center ${
                        r.alloc > 0 && r.tickerTarget > 0
                          ? r.lacking <= 0
                            ? 'text-emerald-600'
                            : r.lacking / r.tickerTarget > 0.2
                              ? 'bg-red-50 text-red-600 dark:bg-red-950'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950'
                          : ''
                      }`}
                    >
                      {r.alloc > 0 ? formatCurrency(r.lacking, currency) : '-'}
                    </td>
                    <td className="py-2 text-center font-mono">
                      {r.alloc > 0 && r.sharesToBuy > 0
                        ? r.sharesToBuy.toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalAllocPct > 0 && (
                <tfoot>
                  <tr className="border-t">
                    <td className="py-2 font-medium" colSpan={2}>
                      Total
                    </td>
                    <td
                      className={`py-2 text-center font-medium ${totalAllocPct !== 100 ? 'text-red-500' : ''}`}
                    >
                      {totalAllocPct}%
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
