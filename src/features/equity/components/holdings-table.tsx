'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useExchangeRate, useStockPrices } from '../hooks/use-prices';
import { getMarket } from '../lib/ticker-map';
import type { EquityTradeData } from '../types';

interface HoldingsTableProps {
  trades: EquityTradeData[];
}

interface Holding {
  ticker: string;
  market: 'SG' | 'US';
  shares: number;
  totalBuyCost: number;
  avgCost: number;
}

function computeHoldings(trades: EquityTradeData[]): Holding[] {
  const map = new Map<
    string,
    {
      shares: number;
      totalBuyCost: number;
      totalBuyShares: number;
      market: 'SG' | 'US';
    }
  >();

  for (const t of trades) {
    const ticker = t.ticker.toUpperCase();
    const existing = map.get(ticker) ?? {
      shares: 0,
      totalBuyCost: 0,
      totalBuyShares: 0,
      market: getMarket(ticker),
    };

    if (t.action === 'buy') {
      existing.shares += t.shares;
      existing.totalBuyCost += t.shares * t.price + t.fees;
      existing.totalBuyShares += t.shares;
    } else {
      existing.shares -= t.shares;
    }

    map.set(ticker, existing);
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.shares > 0)
    .map(([ticker, v]) => ({
      ticker,
      market: v.market,
      shares: v.shares,
      totalBuyCost: v.totalBuyCost,
      avgCost: v.totalBuyShares > 0 ? v.totalBuyCost / v.totalBuyShares : 0,
    }));
}

function formatCurrency(
  value: number,
  currency: 'SGD' | 'USD' = 'SGD'
): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function MarketTable({
  holdings,
  prices,
  displayCurrency,
  rate,
}: {
  holdings: Holding[];
  prices: Record<string, { price: number }> | undefined;
  displayCurrency: 'SGD' | 'USD';
  rate: number;
}) {
  const sorted = [...holdings].sort((a, b) => a.ticker.localeCompare(b.ticker));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2 text-left font-medium">Ticker</th>
          <th className="py-2 text-center font-medium">Price</th>
          <th className="py-2 text-center font-medium">Shares</th>
          <th className="py-2 text-center font-medium">Avg Cost</th>
          <th className="py-2 text-center font-medium">Win/Lose</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((h) => {
          const price = prices?.[h.ticker]?.price ?? 0;
          const winLose =
            h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : 0;

          return (
            <tr key={h.ticker} className="border-b last:border-0">
              <td className="py-2 font-mono font-medium">{h.ticker}</td>
              <td className="py-2 text-center">
                {price > 0
                  ? formatCurrency(price * rate, displayCurrency)
                  : '-'}
              </td>
              <td className="py-2 text-center">{h.shares.toLocaleString()}</td>
              <td className="py-2 text-center">
                {formatCurrency(h.avgCost * rate, displayCurrency)}
              </td>
              <td
                className={`py-2 text-center font-medium ${
                  winLose >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {price > 0 ? formatPct(winLose) : '-'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MarketCard({
  title,
  total,
  holdings,
  prices,
  pricesLoading,
  displayCurrency,
  rate,
  expanded,
  onToggle,
  currencyToggle,
}: {
  title: string;
  total: number;
  holdings: Holding[];
  prices: Record<string, { price: number }> | undefined;
  pricesLoading: boolean;
  displayCurrency: 'SGD' | 'USD';
  rate: number;
  expanded: boolean;
  onToggle: () => void;
  currencyToggle?: React.ReactNode;
}) {
  const accordionValue = expanded ? title : '';

  return (
    <Accordion
      type="single"
      collapsible
      value={accordionValue}
      onValueChange={() => onToggle()}
    >
      <AccordionItem value={title} className="rounded-lg border">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex w-full items-center gap-3">
            <span className="text-lg font-semibold">{title}</span>
            {currencyToggle}
            <span className="text-muted-foreground text-sm font-normal">
              {formatCurrency(total, displayCurrency)}
              {pricesLoading && (
                <Loader2 className="ml-2 inline size-3 animate-spin" />
              )}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="!px-0 pb-0">
          <div className="overflow-x-auto px-6 pb-6">
            <MarketTable
              holdings={holdings}
              prices={prices}
              displayCurrency={displayCurrency}
              rate={rate}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function HoldingsTable({ trades }: HoldingsTableProps) {
  // useMemo justified: aggregates all trades into net holdings per ticker
  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const heldTickers = holdings.map((h) => h.ticker);
  const { data: prices, isLoading: pricesLoading } =
    useStockPrices(heldTickers);
  const { data: usdToSgd } = useExchangeRate('USD', 'SGD');

  const [expanded, setExpanded] = useState(false);
  const [usDisplayCurrency, setUsDisplayCurrency] = useState<'SGD' | 'USD'>(
    'USD'
  );

  const sgHoldings = holdings.filter((h) => h.market === 'SG');
  const usHoldings = holdings.filter((h) => h.market === 'US');

  const usRate = usDisplayCurrency === 'USD' ? 1 : (usdToSgd ?? 0);

  const sgTotal = sgHoldings.reduce((s, h) => {
    return s + h.shares * (prices?.[h.ticker]?.price ?? 0);
  }, 0);
  const usTotal = usHoldings.reduce((s, h) => {
    return s + h.shares * (prices?.[h.ticker]?.price ?? 0);
  }, 0);

  const toggle = () => setExpanded((p) => !p);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sgHoldings.length > 0 && (
        <MarketCard
          title="SG Stocks"
          total={sgTotal}
          holdings={sgHoldings}
          prices={prices}
          pricesLoading={pricesLoading}
          displayCurrency="SGD"
          rate={1}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
      {usHoldings.length > 0 && (
        <MarketCard
          title="US Stocks"
          total={usTotal * usRate}
          holdings={usHoldings}
          prices={prices}
          pricesLoading={pricesLoading}
          displayCurrency={usDisplayCurrency}
          rate={usRate}
          expanded={expanded}
          onToggle={toggle}
          currencyToggle={
            <span
              role="button"
              tabIndex={0}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'h-6 px-2 text-xs'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setUsDisplayCurrency((c) => (c === 'USD' ? 'SGD' : 'USD'));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  setUsDisplayCurrency((c) => (c === 'USD' ? 'SGD' : 'USD'));
                }
              }}
            >
              {usDisplayCurrency}
            </span>
          }
        />
      )}
    </div>
  );
}
