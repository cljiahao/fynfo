'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowDown,
  ArrowUp,
  DollarSign,
  Loader2,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { useStockPrices } from '../hooks/use-prices';
import { getMarket } from '../lib/ticker-map';
import type { EquityTradeData } from '../types';

interface PortfolioSummaryProps {
  trades: EquityTradeData[];
}

function formatSGD(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

interface HoldingSummary {
  ticker: string;
  market: 'SG' | 'US';
  shares: number;
  totalCost: number;
  avgCost: number;
}

function computeHoldings(trades: EquityTradeData[]): HoldingSummary[] {
  const map = new Map<
    string,
    { shares: number; totalBuyCost: number; market: 'SG' | 'US' }
  >();

  for (const t of trades) {
    const ticker = t.ticker.toUpperCase();
    const existing = map.get(ticker) ?? {
      shares: 0,
      totalBuyCost: 0,
      market: getMarket(ticker),
    };

    if (t.action === 'buy') {
      existing.shares += t.shares;
      existing.totalBuyCost += t.shares * t.price + t.fees;
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
      totalCost: v.totalBuyCost,
      avgCost: v.shares > 0 ? v.totalBuyCost / v.shares : 0,
    }));
}

// Cash flow: negative = money out (buy), positive = money in (sell / current value)
interface CashFlow {
  date: Date;
  amount: number;
}

// Compute annualised MWR (IRR) via Newton's method
// NPV = Σ CF_i / (1 + r)^(years_i) = 0, solve for r
function computeIRR(cashFlows: CashFlow[]): number {
  if (cashFlows.length < 2) return 0;

  const t0 = cashFlows[0].date.getTime();
  const years = cashFlows.map(
    (cf) => (cf.date.getTime() - t0) / (365.25 * 24 * 60 * 60 * 1000)
  );

  let r = 0.1; // initial guess 10%
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const disc = Math.pow(1 + r, years[i]);
      npv += cashFlows[i].amount / disc;
      dnpv -= (years[i] * cashFlows[i].amount) / (disc * (1 + r));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const step = npv / dnpv;
    r -= step;
    // Clamp to prevent divergence
    if (r <= -1) r = -0.99;
    if (Math.abs(step) < 1e-10) break;
  }

  return r * 100;
}

function buildCashFlows(
  trades: EquityTradeData[],
  holdings: HoldingSummary[],
  prices: Record<string, { price: number }>,
  marketFilter?: 'SG' | 'US'
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const t of trades) {
    const market = getMarket(t.ticker.toUpperCase());
    if (marketFilter && market !== marketFilter) continue;

    const total = t.shares * t.price + t.fees;
    flows.push({
      date: new Date(t.date),
      amount: t.action === 'buy' ? -total : total - t.fees, // sell: proceeds minus fees
    });
  }

  // Add current portfolio value as final positive cash flow (today)
  const now = new Date();
  for (const h of holdings) {
    if (marketFilter && h.market !== marketFilter) continue;
    const p = prices[h.ticker]?.price ?? 0;
    if (p > 0) {
      flows.push({ date: now, amount: h.shares * p });
    }
  }

  flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return flows;
}

export function PortfolioSummary({ trades }: PortfolioSummaryProps) {
  // useMemo justified: iterates all trades to compute holdings on every render
  const holdings = useMemo(() => computeHoldings(trades), [trades]);

  const heldTickers = holdings.map((h) => h.ticker);
  const { data: prices, isLoading: pricesLoading } =
    useStockPrices(heldTickers);

  const sgHoldings = holdings.filter((h) => h.market === 'SG');
  const usHoldings = holdings.filter((h) => h.market === 'US');

  // Total cost (what was spent)
  const sgCost = sgHoldings.reduce((s, h) => s + h.totalCost, 0);
  const usCost = usHoldings.reduce((s, h) => s + h.totalCost, 0);

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
            <div className="text-2xl font-bold">{formatSGD(totalCost)}</div>
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
            </CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatSGD(totalValue)}</div>
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
          </CardContent>
        </Card>

        {/* Unrealised P&L */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Unrealised P&L
            </CardTitle>
            {totalPnl >= 0 ? (
              <ArrowUp className="size-4 text-emerald-500" />
            ) : (
              <ArrowDown className="size-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {totalPnl >= 0 ? '+' : ''}
              {formatSGD(totalPnl)}
            </div>
            <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              <div className="flex-between">
                <span>SG</span>
                <span
                  className={sgPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}
                >
                  {sgPnl >= 0 ? '+' : ''}
                  {formatSGD(sgPnl)}
                </span>
              </div>
              <div className="flex-between">
                <span>US</span>
                <span
                  className={usPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}
                >
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
            <div
              className={`text-2xl font-bold ${mwrPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {mwrPct >= 0 ? '+' : ''}
              {mwrPct.toFixed(2)}%
            </div>
            <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              <div className="flex-between">
                <span>SG</span>
                <span
                  className={
                    sgMwrPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }
                >
                  {sgMwrPct >= 0 ? '+' : ''}
                  {sgMwrPct.toFixed(2)}%
                </span>
              </div>
              <div className="flex-between">
                <span>US</span>
                <span
                  className={
                    usMwrPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }
                >
                  {usMwrPct >= 0 ? '+' : ''}
                  {usMwrPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
