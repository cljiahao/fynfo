'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSGD, formatUSD } from '@/lib/utils/currency';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  DollarSign,
  Loader2,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { useStockPrices } from '../hooks/use-prices';
import { computeHoldings } from '../lib/holdings';
import { buildCashFlows, computeIRR } from '../lib/mwr';
import type { EquityTradeData } from '../types';

interface PortfolioSummaryProps {
  trades: EquityTradeData[];
}

export function PortfolioSummary({ trades }: PortfolioSummaryProps) {
  // useMemo justified: iterates all trades to compute holdings on every render
  const holdings = useMemo(() => computeHoldings(trades), [trades]);

  const heldTickers = holdings.map((h) => h.ticker);
  const {
    data: prices,
    isLoading: pricesLoading,
    isError: pricesError,
  } = useStockPrices(heldTickers);

  const sgHoldings = holdings.filter((h) => h.market === 'SG');
  const usHoldings = holdings.filter((h) => h.market === 'US');

  // Total cost (what was spent)
  const sgCost = sgHoldings.reduce((s, h) => s + h.totalBuyCost, 0);
  const usCost = usHoldings.reduce((s, h) => s + h.totalBuyCost, 0);

  // Current value (shares × current price)
  const sgValue = sgHoldings.reduce((s, h) => {
    const p = prices?.[h.ticker]?.price ?? 0;
    return s + h.shares * p;
  }, 0);
  const usValue = usHoldings.reduce((s, h) => {
    const p = prices?.[h.ticker]?.price ?? 0;
    return s + h.shares * p;
  }, 0);

  const totalCost = sgCost + usCost;
  const totalValue = sgValue + usValue;
  const totalPnl = totalValue - totalCost;

  const sgPnl = sgValue - sgCost;
  const usPnl = usValue - usCost;

  // Money-Weighted Return (IRR): annualised return accounting for cash flow timing
  const mwrPct = useMemo(
    () => (prices ? computeIRR(buildCashFlows(trades, holdings, prices)) : 0),
    [trades, holdings, prices]
  );
  const sgMwrPct = useMemo(
    () =>
      prices ? computeIRR(buildCashFlows(trades, holdings, prices, 'SG')) : 0,
    [trades, holdings, prices]
  );
  const usMwrPct = useMemo(
    () =>
      prices ? computeIRR(buildCashFlows(trades, holdings, prices, 'US')) : 0,
    [trades, holdings, prices]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cost */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Invested
            </CardTitle>
            <DollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatSGD(totalCost)}
            </div>
            <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              <div className="flex-between">
                <span>SG</span>
                <span>{formatSGD(sgCost)}</span>
              </div>
              <div className="flex-between">
                <span>US</span>
                <span>{formatUSD(usCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Value */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Current Value
              {pricesLoading && (
                <Loader2 className="ml-2 inline size-3 animate-spin" />
              )}
              {pricesError && (
                <AlertCircle className="text-warning ml-2 inline size-3" />
              )}
            </CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {pricesError || pricesLoading ? (
              <p className="text-muted-foreground text-sm">
                {pricesError ? 'Prices unavailable' : 'Loading…'}
              </p>
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {formatSGD(totalValue)}
                </div>
                <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                  <div className="flex-between">
                    <span>SG</span>
                    <span>{formatSGD(sgValue)}</span>
                  </div>
                  <div className="flex-between">
                    <span>US</span>
                    <span>{formatUSD(usValue)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Unrealised P&L */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Unrealised P&L
            </CardTitle>
            {totalPnl >= 0 ? (
              <ArrowUp className="text-gain size-4" />
            ) : (
              <ArrowDown className="text-loss size-4" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${totalPnl >= 0 ? 'text-gain' : 'text-loss'}`}
            >
              {totalPnl >= 0 ? '+' : ''}
              {formatSGD(totalPnl)}
            </div>
            <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              <div className="flex-between">
                <span>SG</span>
                <span className={sgPnl >= 0 ? 'text-gain' : 'text-loss'}>
                  {sgPnl >= 0 ? '+' : ''}
                  {formatSGD(sgPnl)}
                </span>
              </div>
              <div className="flex-between">
                <span>US</span>
                <span className={usPnl >= 0 ? 'text-gain' : 'text-loss'}>
                  {usPnl >= 0 ? '+' : ''}
                  {formatUSD(usPnl)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MWR (annualised) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Annualised Return
            </CardTitle>
            <Percent className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {pricesError || pricesLoading ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <>
                <div
                  className={`text-2xl font-bold tabular-nums ${mwrPct >= 0 ? 'text-gain' : 'text-loss'}`}
                >
                  {mwrPct >= 0 ? '+' : ''}
                  {mwrPct.toFixed(2)}%
                </div>
                <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                  <div className="flex-between">
                    <span>SG</span>
                    <span className={sgMwrPct >= 0 ? 'text-gain' : 'text-loss'}>
                      {sgMwrPct >= 0 ? '+' : ''}
                      {sgMwrPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex-between">
                    <span>US</span>
                    <span className={usMwrPct >= 0 ? 'text-gain' : 'text-loss'}>
                      {usMwrPct >= 0 ? '+' : ''}
                      {usMwrPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
