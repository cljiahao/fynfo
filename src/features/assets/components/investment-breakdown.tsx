'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTrades } from '@/features/equity/hooks/use-equity';
import { useStockPrices } from '@/features/equity/hooks/use-prices';
import { computeHoldings } from '@/features/equity/lib/holdings';
import { getMarket } from '@/features/equity/lib/ticker-map';
import { formatSGD } from '@/lib/utils/currency';
import { loadLocal, saveLocal } from '@/lib/utils/local-store';
import { useEffect, useMemo, useState } from 'react';
import {
  computeInvestmentBreakdown,
  computeMarketEquity,
  computeQuarterSpend,
  getCurrentQuarter,
  sumCat,
  type MarketBudgets,
} from '../lib/investment-math';
import type { SnapshotData } from '../types';
import { DeployableCashBreakdown } from './deployable-cash-breakdown';
import { MarketDeploymentCard } from './market-deployment-card';
import { MonthlyInvestmentTable } from './monthly-investment-table';

export type { MarketBudgets } from '../lib/investment-math';

interface InvestmentBreakdownProps {
  investmentAmount: number;
  emergencyFundGoal: number;
  warChestGoal: number;
  snapshot?: SnapshotData;
  onBudgetsChange?: (budgets: MarketBudgets) => void;
}

const CASH_ALLOC_KEY = 'fynfo-cash-allocation';
const RATIOS_KEY = 'fynfo-investment-ratios';

export function InvestmentBreakdown({
  investmentAmount,
  emergencyFundGoal,
  warChestGoal,
  snapshot,
  onBudgetsChange,
}: InvestmentBreakdownProps) {
  const { data: trades } = useTrades();

  // useMemo justified: iterates all trades to aggregate holdings by market
  const holdings = useMemo(() => computeHoldings(trades ?? []), [trades]);

  const heldTickers = holdings.map((h) => h.ticker);
  const { data: prices } = useStockPrices(heldTickers);

  const { sgEquity, usEquity } = computeMarketEquity(holdings, prices);

  const [ratios, setRatios] = useState(() =>
    loadLocal(RATIOS_KEY, { rsp: 30, us: 20, sg: 50 })
  );
  const [cashAlloc, setCashAlloc] = useState(() =>
    loadLocal(CASH_ALLOC_KEY, { sg: 60, us: 40 })
  );

  const updateRatio = (key: 'rsp' | 'us' | 'sg', v: number) =>
    setRatios((p) => {
      const next = { ...p, [key]: v };
      saveLocal(RATIOS_KEY, next);
      return next;
    });

  const updateCashAlloc = (next: { sg: number; us: number }) => {
    setCashAlloc(next);
    saveLocal(CASH_ALLOC_KEY, next);
  };

  // Current quarter
  const {
    label: qLabel,
    start: qStart,
    end: qEnd,
    daysLeft: qDaysLeft,
  } = getCurrentQuarter();

  // useMemo justified: filters and sums trades for current quarter per market
  const { sgSpent, usSpent } = useMemo(
    () => computeQuarterSpend(trades ?? [], qStart, qEnd, getMarket),
    [trades, qStart, qEnd]
  );

  const currentSavings = snapshot ? sumCat(snapshot.entries, 'savings') : 0;
  const currentBonds = snapshot ? sumCat(snapshot.entries, 'bonds') : 0;

  const {
    totalRatio,
    rspMonthly,
    sgMonthly,
    usMonthly,
    sgQuarterly,
    usQuarterly,
    bondsSurplus,
    bondsShortfall,
    totalDeployable,
    sgCash,
    usCash,
    sgTarget,
    usTarget,
    sgAvailable,
    usAvailable,
    sgDeployPct,
    usDeployPct,
    budgets,
  } = useMemo(
    () =>
      computeInvestmentBreakdown({
        investmentAmount,
        ratios,
        cashAlloc,
        savings: currentSavings,
        bonds: currentBonds,
        emergencyFundGoal,
        warChestGoal,
        sgEquity,
        usEquity,
        sgSpent,
        usSpent,
      }),
    [
      investmentAmount,
      ratios,
      cashAlloc,
      currentSavings,
      currentBonds,
      emergencyFundGoal,
      warChestGoal,
      sgEquity,
      usEquity,
      sgSpent,
      usSpent,
    ]
  );

  useEffect(() => {
    onBudgetsChange?.(budgets);
  }, [budgets, onBudgetsChange]);

  if (investmentAmount <= 0) return null;

  const hasUndeployed = sgAvailable > 0 || usAvailable > 0;

  const markets = [
    {
      market: {
        label: 'SG',
        quarterly: sgQuarterly,
        spent: sgSpent,
        equity: sgEquity,
        target: sgTarget,
        available: sgAvailable,
        deployPct: sgDeployPct,
      },
      cashAllocPct: cashAlloc.sg,
    },
    {
      market: {
        label: 'US',
        quarterly: usQuarterly,
        spent: usSpent,
        equity: usEquity,
        target: usTarget,
        available: usAvailable,
        deployPct: usDeployPct,
      },
      cashAllocPct: cashAlloc.us,
    },
  ];

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Investment Breakdown</CardTitle>
          <CardDescription>
            How your monthly {formatSGD(investmentAmount)} is split and tracked
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Warning banner — top for visibility */}
          {hasUndeployed && qDaysLeft <= 30 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-semibold">
                {qDaysLeft} days left in {qLabel}
              </p>
              <p className="mt-0.5">
                {sgAvailable > 0 &&
                  `SG: ${formatSGD(sgAvailable)} undeployed. `}
                {usAvailable > 0 && `US: ${formatSGD(usAvailable)} undeployed.`}
              </p>
            </div>
          )}

          {/* SG & US Market Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {markets.map((m) => (
              <MarketDeploymentCard
                key={m.market.label}
                market={m.market}
                qLabel={qLabel}
                qDaysLeft={qDaysLeft}
                cashAllocPct={m.cashAllocPct}
              />
            ))}
          </div>

          {/* Two columns: Category Ratios | Deployable Cash */}
          <div className="grid gap-6 sm:grid-cols-2">
            <MonthlyInvestmentTable
              investmentAmount={investmentAmount}
              ratios={ratios}
              rspMonthly={rspMonthly}
              sgMonthly={sgMonthly}
              usMonthly={usMonthly}
              totalRatio={totalRatio}
              updateRatio={updateRatio}
            />

            {snapshot && (
              <DeployableCashBreakdown
                totalDeployable={totalDeployable}
                currentSavings={currentSavings}
                emergencyFundGoal={emergencyFundGoal}
                currentBonds={currentBonds}
                warChestGoal={warChestGoal}
                bondsShortfall={bondsShortfall}
                bondsSurplus={bondsSurplus}
                cashAlloc={cashAlloc}
                sgCash={sgCash}
                usCash={usCash}
                updateCashAlloc={updateCashAlloc}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
