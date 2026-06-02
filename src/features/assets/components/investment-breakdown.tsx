'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrades } from '@/features/equity/hooks/use-equity';
import { useStockPrices } from '@/features/equity/hooks/use-prices';
import { computeHoldings } from '@/features/equity/lib/holdings';
import { getMarket } from '@/features/equity/lib/ticker-map';
import { formatSGD } from '@/lib/utils/currency';
import { loadLocal, saveLocal } from '@/lib/utils/local-store';
import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  computeInvestmentBreakdown,
  computeMarketEquity,
  computeQuarterSpend,
  deployPctColor,
  getCurrentQuarter,
  sumCat,
  type MarketBudgets,
} from '../lib/investment-math';
import type { SnapshotData } from '../types';

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
            {[
              {
                label: 'SG',
                quarterly: sgQuarterly,
                cash: sgCash,
                spent: sgSpent,
                equity: sgEquity,
                target: sgTarget,
                available: sgAvailable,
                deployPct: sgDeployPct,
              },
              {
                label: 'US',
                quarterly: usQuarterly,
                cash: usCash,
                spent: usSpent,
                equity: usEquity,
                target: usTarget,
                available: usAvailable,
                deployPct: usDeployPct,
              },
            ].map((m) => {
              const qPct =
                m.quarterly > 0
                  ? Math.min((m.spent / m.quarterly) * 100, 100)
                  : 0;
              const targetPct =
                m.target > 0 ? Math.min((m.equity / m.target) * 100, 100) : 0;
              const pctLabel = m.deployPct.toFixed(0);
              return (
                <div key={m.label} className="space-y-2 rounded-lg border p-4">
                  <div className="flex-between text-sm">
                    <span className="font-semibold">
                      {m.label} — {qLabel}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {qDaysLeft}d left
                    </span>
                  </div>

                  {/* Quarterly budget progress */}
                  <div className="space-y-0.5">
                    <div className="flex-between text-muted-foreground text-[10px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">
                            Budget ({qLabel})
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64 space-y-1.5 p-3">
                          <p className="font-semibold">Budget ({qLabel})</p>
                          <p className="text-primary-foreground/80 leading-relaxed">
                            Projected from your monthly salary allocation.
                            Assumes continued income for the quarter.
                          </p>
                          <p className="text-primary-foreground/60 leading-relaxed">
                            Spent {formatSGD(m.spent)} of{' '}
                            {formatSGD(m.quarterly)} this quarter.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <span>
                        {formatSGD(m.spent)} / {formatSGD(m.quarterly)}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${qPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${qPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Portfolio target progress */}
                  <div className="space-y-0.5">
                    <div className="flex-between text-muted-foreground text-[10px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">
                            Portfolio Target
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64 space-y-1.5 p-3">
                          <p className="font-semibold">Portfolio Target</p>
                          <p className="text-primary-foreground/80 leading-relaxed">
                            Based on cash you can deploy today. Shows current
                            equity vs your allocation target.
                          </p>
                          <p className="text-primary-foreground/60 leading-relaxed">
                            Holding {formatSGD(m.equity)} of{' '}
                            {formatSGD(m.target)} target.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <span>
                        {formatSGD(m.equity)} / {formatSGD(m.target)}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${targetPct >= 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                        style={{ width: `${targetPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex-between">
                      <span className="text-muted-foreground">
                        Target ({m.label === 'SG' ? cashAlloc.sg : cashAlloc.us}
                        %)
                      </span>
                      <span className="font-medium">{formatSGD(m.target)}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-muted-foreground">
                        Current equity
                      </span>
                      <span>{formatSGD(m.equity)}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-muted-foreground">
                        Quarterly budget
                      </span>
                      <span>{formatSGD(m.quarterly)}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-muted-foreground">
                        Spent this quarter
                      </span>
                      <span>{formatSGD(m.spent)}</span>
                    </div>
                    <div className="flex-between border-t pt-1 font-semibold">
                      <span className="flex items-center gap-1.5">
                        Available
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`cursor-help text-[10px] font-bold ${deployPctColor(m.deployPct)}`}
                            >
                              {pctLabel}%
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64 space-y-1.5 p-3">
                            <p className="font-semibold">Deployment Status</p>
                            <p className="text-primary-foreground/80 leading-relaxed">
                              {m.deployPct > 50
                                ? 'High cash available — consider deploying more into the market.'
                                : m.deployPct > 20
                                  ? 'Moderate cash remaining to be deployed.'
                                  : 'Well deployed — most of your cash is invested.'}
                            </p>
                            <p className="text-primary-foreground/60 leading-relaxed">
                              {formatSGD(m.available)} of {formatSGD(m.target)}{' '}
                              still available.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <span
                        className={
                          m.available > 0
                            ? 'text-emerald-600'
                            : 'text-muted-foreground'
                        }
                      >
                        {formatSGD(m.available)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Two columns: Category Ratios | Deployable Cash */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Left: Monthly Investment Breakdown */}
            <div className="overflow-x-auto">
              <Accordion type="single" collapsible>
                <AccordionItem value="monthly" className="border-none">
                  <AccordionTrigger className="text-muted-foreground p-0 text-xs font-medium">
                    Monthly Investment — {formatSGD(investmentAmount)}
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pt-2 pb-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 text-left font-medium">
                            Category
                          </th>
                          <th className="py-2 text-center font-medium">
                            Ratio
                          </th>
                          <th className="py-2 text-right font-medium">
                            Monthly
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            label: 'RSP',
                            key: 'rsp' as const,
                            monthly: rspMonthly,
                          },
                          {
                            label: 'SG Market',
                            key: 'sg' as const,
                            monthly: sgMonthly,
                          },
                          {
                            label: 'US Market',
                            key: 'us' as const,
                            monthly: usMonthly,
                          },
                        ].map((row) => (
                          <tr key={row.key} className="border-b last:border-0">
                            <td className="py-2 font-medium">{row.label}</td>
                            <td className="py-2 text-center">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                className="mx-auto h-7 w-16 text-center text-xs"
                                value={ratios[row.key] || ''}
                                placeholder="0"
                                onChange={(e) =>
                                  updateRatio(
                                    row.key,
                                    Number(e.target.value) || 0
                                  )
                                }
                              />
                            </td>
                            <td className="py-2 text-right">
                              {formatSGD(row.monthly)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t">
                          <td className="py-2 font-semibold">Total</td>
                          <td
                            className={`py-2 text-center font-semibold ${totalRatio !== 100 ? 'text-red-500' : ''}`}
                          >
                            {totalRatio}%
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {formatSGD(investmentAmount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {totalRatio !== 100 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="size-3" />
                        Must sum to 100%
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Right: Deployable Cash Breakdown */}
            {snapshot && (
              <div className="text-sm">
                <Accordion type="single" collapsible>
                  <AccordionItem value="deployable" className="border-none">
                    <AccordionTrigger className="text-muted-foreground p-0 text-xs font-medium">
                      Deployable Cash — {formatSGD(totalDeployable)}
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pt-2 pb-0">
                      <div className="space-y-1.5">
                        <div className="flex-between text-xs">
                          <span>Savings</span>
                          <span className="font-medium">
                            {formatSGD(currentSavings)}
                          </span>
                        </div>
                        <div className="flex-between text-muted-foreground text-xs">
                          <span>− Emergency Fund</span>
                          <span>{formatSGD(emergencyFundGoal)}</span>
                        </div>
                        <div className="flex-between text-xs">
                          <span>Bonds (war chest)</span>
                          <span className="font-medium">
                            {formatSGD(currentBonds)}
                          </span>
                        </div>
                        <div className="flex-between text-muted-foreground text-xs">
                          <span>− War chest goal</span>
                          <span>{formatSGD(warChestGoal)}</span>
                        </div>
                        {bondsShortfall > 0 && (
                          <div className="flex-between text-xs text-amber-500">
                            <span>− War chest shortfall</span>
                            <span>{formatSGD(bondsShortfall)}</span>
                          </div>
                        )}
                        {bondsSurplus > 0 && (
                          <div className="flex-between text-xs text-emerald-600">
                            <span>+ Bonds surplus</span>
                            <span>{formatSGD(bondsSurplus)}</span>
                          </div>
                        )}
                        <div className="flex-between border-t pt-1.5 font-semibold">
                          <span>Total Deployable</span>
                          <span
                            className={
                              totalDeployable > 0
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }
                          >
                            {formatSGD(totalDeployable)}
                          </span>
                        </div>
                      </div>

                      {/* Market allocation */}
                      {totalDeployable > 0 && (
                        <div className="mt-2 space-y-1 border-t pt-1.5">
                          {[
                            {
                              label: 'SG',
                              value: cashAlloc.sg,
                              amount: sgCash,
                              onChange: (v: number) =>
                                updateCashAlloc({ sg: v, us: 100 - v }),
                            },
                            {
                              label: 'US',
                              value: cashAlloc.us,
                              amount: usCash,
                              onChange: (v: number) =>
                                updateCashAlloc({ sg: 100 - v, us: v }),
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="flex-between text-xs"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="w-6 font-medium">
                                  {row.label}
                                </span>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="h-6 w-16 text-center text-xs"
                                  value={row.value || ''}
                                  onChange={(e) =>
                                    row.onChange(Number(e.target.value) || 0)
                                  }
                                />
                                <span className="text-muted-foreground">%</span>
                              </span>
                              <span className="font-semibold">
                                {formatSGD(row.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
