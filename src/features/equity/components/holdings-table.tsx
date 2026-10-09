'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/currency';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useExchangeRate, useStockPrices } from '../hooks/use-prices';
import { computeHoldings, type Holding } from '../lib/holdings';
import {
  finiteProduct,
  holdingPrice,
  marketValue,
  validExchangeRate,
  type ValuationQuote,
} from '../lib/valuation';
import type { EquityTradeData } from '../types';

interface HoldingsTableProps {
  trades: EquityTradeData[];
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
  prices: Record<string, ValuationQuote> | undefined;
  displayCurrency: 'SGD' | 'USD';
  rate: number | null;
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
          const price = holdingPrice(h, prices);
          const rawWinLose =
            h.avgBuyPrice > 0 && price !== null
              ? ((price - h.avgBuyPrice) / h.avgBuyPrice) * 100
              : null;
          const winLose =
            rawWinLose !== null && Number.isFinite(rawWinLose)
              ? rawWinLose
              : null;

          return (
            <tr key={h.ticker} className="border-b last:border-0">
              <td className="py-2 font-mono font-medium">{h.ticker}</td>
              <td className="py-2 text-center tabular-nums">
                {price !== null && rate !== null
                  ? finiteProduct(price, rate) === null
                    ? '—'
                    : formatCurrency(price * rate, displayCurrency)
                  : '-'}
              </td>
              <td className="py-2 text-center tabular-nums">
                {h.shares.toLocaleString()}
              </td>
              <td className="py-2 text-center tabular-nums">
                {rate === null
                  ? '—'
                  : finiteProduct(h.avgBuyPrice, rate) === null
                    ? '—'
                    : formatCurrency(h.avgBuyPrice * rate, displayCurrency)}
              </td>
              <td
                className={`py-2 text-center font-medium tabular-nums ${
                  winLose === null
                    ? ''
                    : winLose >= 0
                      ? 'text-gain'
                      : 'text-loss'
                }`}
              >
                {price !== null && rate !== null && winLose !== null
                  ? `${winLose >= 0 ? '▲' : '▼'} ${formatPct(winLose)}`
                  : '-'}
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
  total: number | null;
  holdings: Holding[];
  prices: Record<string, ValuationQuote> | undefined;
  pricesLoading: boolean;
  displayCurrency: 'SGD' | 'USD';
  rate: number | null;
  expanded: boolean;
  onToggle: () => void;
  currencyToggle?: React.ReactNode;
}) {
  const accordionValue = expanded ? title : '';

  return (
    <div className="space-y-2">
      {currencyToggle}
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
              <span className="text-muted-foreground text-sm font-normal">
                {total === null
                  ? 'Prices or exchange rate unavailable'
                  : formatCurrency(total, displayCurrency)}
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
    </div>
  );
}

export function HoldingsTable({ trades }: HoldingsTableProps) {
  // useMemo justified: aggregates all trades into net holdings per ticker
  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const heldTickers = holdings.map((h) => h.ticker);
  const {
    data: prices,
    isLoading: pricesLoading,
    isError: pricesError,
  } = useStockPrices(heldTickers);
  const { data: usdToSgd, isError: rateError } = useExchangeRate('USD', 'SGD');

  const [expanded, setExpanded] = useState(false);
  const [usDisplayCurrency, setUsDisplayCurrency] = useState<'SGD' | 'USD'>(
    'USD'
  );

  const sgHoldings = holdings.filter((h) => h.market === 'SG');
  const usHoldings = holdings.filter((h) => h.market === 'US');

  const usRate =
    usDisplayCurrency === 'USD'
      ? 1
      : !rateError && validExchangeRate(usdToSgd)
        ? usdToSgd
        : null;

  const sgTotal = pricesError ? null : marketValue(sgHoldings, prices);
  const usTotal = pricesError ? null : marketValue(usHoldings, prices);

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
          total={
            usTotal === null || usRate === null
              ? null
              : finiteProduct(usTotal, usRate)
          }
          holdings={usHoldings}
          prices={prices}
          pricesLoading={pricesLoading}
          displayCurrency={usDisplayCurrency}
          rate={usRate}
          expanded={expanded}
          onToggle={toggle}
          currencyToggle={
            <Button
              variant="outline"
              size="sm"
              className="h-8 justify-self-start text-xs"
              title="Switch US holdings display currency. SGD uses the current exchange-rate estimate."
              onClick={() =>
                setUsDisplayCurrency((currency) =>
                  currency === 'USD' ? 'SGD' : 'USD'
                )
              }
            >
              {usDisplayCurrency}
            </Button>
          }
        />
      )}
    </div>
  );
}
