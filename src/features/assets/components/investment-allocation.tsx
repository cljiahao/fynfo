'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTrades } from '@/features/equity/hooks/use-equity';
import {
  useExchangeRate,
  useStockPrices,
} from '@/features/equity/hooks/use-prices';
import { computeHoldings } from '@/features/equity/lib/holdings';
import { loadLocal, saveLocal } from '@/lib/utils/local-store';
import { useMemo, useState } from 'react';
import type { MarketBudgets } from './investment-breakdown';
import { MarketAllocationTable } from './market-allocation-table';

interface InvestmentAllocationProps {
  budgets?: MarketBudgets | null;
}

const STORAGE_KEY = 'fynfo-allocations';

export function InvestmentAllocation({ budgets }: InvestmentAllocationProps) {
  const { data: trades } = useTrades();
  // useMemo justified: iterates all trades to aggregate net holdings per ticker
  const holdings = useMemo(() => computeHoldings(trades ?? []), [trades]);
  const heldTickers = holdings.map((h) => h.ticker);
  const { data: prices, isLoading: pricesLoading } =
    useStockPrices(heldTickers);
  const { data: usdToSgd } = useExchangeRate('USD', 'SGD');

  const [allocations, setAllocations] = useState<Record<string, number>>(() =>
    loadLocal<Record<string, number>>(STORAGE_KEY, {})
  );

  const handleAllocationChange = (ticker: string, pct: number) => {
    setAllocations((prev) => {
      const next = { ...prev, [ticker]: pct };
      saveLocal(STORAGE_KEY, next);
      return next;
    });
  };

  const sgHoldings = holdings.filter((h) => h.market === 'SG');
  const usHoldings = holdings.filter((h) => h.market === 'US');

  if (holdings.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Allocation</CardTitle>
        <CardDescription>
          Set a target % per stock to see how much to buy.
          {budgets ? ' Targets are based on your market allocation.' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sgHoldings.length > 0 && (
          <MarketAllocationTable
            title="SG Stocks"
            holdings={sgHoldings}
            prices={prices}
            pricesLoading={pricesLoading}
            allocations={allocations}
            onAllocationChange={handleAllocationChange}
            currency="SGD"
            target={budgets?.sg.target ?? 0}
            usdToSgd={usdToSgd ?? 0}
          />
        )}
        {usHoldings.length > 0 && (
          <MarketAllocationTable
            title="US Stocks"
            holdings={usHoldings}
            prices={prices}
            pricesLoading={pricesLoading}
            allocations={allocations}
            onAllocationChange={handleAllocationChange}
            currency="USD"
            target={budgets?.us.target ?? 0}
            usdToSgd={usdToSgd ?? 0}
          />
        )}
      </CardContent>
    </Card>
  );
}
