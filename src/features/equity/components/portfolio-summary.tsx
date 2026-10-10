'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/currency';
import { useMemo } from 'react';
import { VALUATION_MARKETS } from '../constants';
import { useStockPrices } from '../hooks/use-prices';
import { computeHoldings } from '../lib/holdings';
import { buildCashFlows, verifiedIRR } from '../lib/mwr';
import { marketValue, nativeCurrency } from '../lib/valuation';
import type { EquityTradeData } from '../types';

interface PortfolioSummaryProps {
  trades: EquityTradeData[];
}

export function PortfolioSummary({ trades }: PortfolioSummaryProps) {
  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const {
    data: prices,
    isLoading,
    isError,
    isFetching,
    isStale,
    dataUpdatedAt,
  } = useStockPrices(holdings.map((holding) => holding.ticker));
  const markets = VALUATION_MARKETS.map((market) => {
    const rows = holdings.filter((holding) => holding.market === market);
    const currency = nativeCurrency(market);
    const rawInvested = rows.reduce(
      (total, holding) => total + holding.totalBuyCost,
      0
    );
    const rawCost = rows.reduce(
      (total, holding) => total + holding.avgBuyPrice * holding.shares,
      0
    );
    const invested = Number.isFinite(rawInvested) ? rawInvested : null;
    const cost = Number.isFinite(rawCost) ? rawCost : null;
    const value = isError && rows.length > 0 ? null : marketValue(rows, prices);
    const flows =
      value === null ? [] : buildCashFlows(trades, rows, prices ?? {}, market);
    const result = verifiedIRR(flows);
    return {
      market,
      currency,
      invested,
      value,
      pnl:
        value === null || cost === null || !Number.isFinite(value - cost)
          ? null
          : value - cost,
      annualised: result !== null && Number.isFinite(result) ? result : null,
    };
  });
  const unavailable =
    holdings.length > 0 &&
    (isError || markets.some((market) => market.value === null));
  const sourceTimes = holdings
    .map((holding) => prices?.[holding.ticker]?.asOf)
    .filter((time): time is string => Boolean(time));
  const oldestSource =
    sourceTimes.length === holdings.length && sourceTimes.length > 0
      ? [...sourceTimes].sort()[0]
      : null;

  function amounts(key: 'invested' | 'value' | 'pnl' | 'annualised') {
    return markets.map((market) => {
      const amount = market[key];
      const signed = key === 'pnl' || key === 'annualised';
      return (
        <div
          key={market.market}
          className="flex items-baseline justify-between gap-3"
        >
          <span className="text-muted-foreground text-sm">
            {market.market} · {market.currency}
          </span>
          <span
            className={`text-lg font-semibold tabular-nums ${signed && amount !== null ? (amount >= 0 ? 'text-gain' : 'text-loss') : ''}`}
          >
            {amount === null
              ? '—'
              : `${signed && amount >= 0 ? '+' : ''}${key === 'annualised' ? `${amount.toFixed(2)}%` : formatCurrency(amount, market.currency)}`}
          </span>
        </div>
      );
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        SGD and USD are shown separately. Returns exclude dividends and currency
        movements.
      </p>
      {isLoading && holdings.length > 0 ? (
        <p role="status" className="text-muted-foreground text-sm">
          Loading…
        </p>
      ) : unavailable ? (
        <p role="status" className="text-warning text-sm">
          Prices unavailable for some holdings. Incomplete market values and
          returns are hidden.
        </p>
      ) : null}
      {holdings.length > 0 && dataUpdatedAt > 0 && (
        <p className="text-muted-foreground text-sm">
          Quote check: {new Date(dataUpdatedAt).toLocaleString()}.
          {isFetching
            ? ' Updating quotes…'
            : isStale
              ? ' Cached quotes await refresh.'
              : ''}
        </p>
      )}
      {holdings.length > 0 && prices && (
        <p className="text-muted-foreground text-sm">
          {oldestSource
            ? `Oldest provider quote: ${new Date(oldestSource).toLocaleString()}. Quotes may be delayed.`
            : 'Provider quote time unavailable. Quotes may be delayed.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Invested
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{amounts('invested')}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Value</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{amounts('value')}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Unrealised P&amp;L
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">{amounts('pnl')}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Annualised Return
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {amounts('annualised')}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
