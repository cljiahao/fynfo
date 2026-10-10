'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSGD } from '@/lib/utils/currency';
import { Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDividends } from '../hooks/use-dividends';
import { useExchangeRate } from '../hooks/use-prices';
import { totalSGD } from '../lib/dividend-metrics';
import { validExchangeRate } from '../lib/valuation';
import type { DividendData, EquityTradeData } from '../types';
import { DividendFormDialog } from './dividend-form';
import { DividendIncomeChart } from './dividend-income-chart';
import { DividendScanDialog } from './dividend-scan-dialog';
import { DividendTable } from './dividend-table';
import { YieldOnCostTable } from './yield-on-cost-table';

interface DistributionsSectionProps {
  trades: EquityTradeData[];
}

export function DistributionsSection({ trades }: DistributionsSectionProps) {
  const {
    data: dividends,
    isPending,
    isError,
    isSuccess,
    refetch,
  } = useDividends();
  const historyReady = isSuccess && !isError;
  const { data: rate, isError: rateError } = useExchangeRate('USD', 'SGD');
  const usdSgdRate = !rateError && validExchangeRate(rate) ? rate : null;
  const rows = useMemo(() => dividends ?? [], [dividends]);

  const [formOpen, setFormOpen] = useState(false);
  const [editDividend, setEditDividend] = useState<DividendData | undefined>();

  const requiresRate = rows.some((row) => row.currency === 'USD');
  const convertedTotal =
    !requiresRate || usdSgdRate !== null
      ? totalSGD(rows, usdSgdRate ?? 1)
      : null;
  const conversionReady =
    convertedTotal !== null && Number.isFinite(convertedTotal);
  const total = conversionReady ? convertedTotal : null;
  const asOf = new Date().toISOString().slice(0, 10);

  function handleAdd() {
    setEditDividend(undefined);
    setFormOpen(true);
  }

  function handleEdit(dividend: DividendData) {
    setEditDividend(dividend);
    setFormOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex-between">
          <div>
            <CardTitle>Distributions</CardTitle>
            <CardDescription>
              Dividends received
              {historyReady && rows.length > 0 && total !== null
                ? ` — ${formatSGD(total)} total`
                : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DistributionScan
              key={historyReady ? 'ready' : 'unavailable'}
              ready={historyReady}
              trades={trades}
              existing={rows}
            />
            <Button size="sm" onClick={handleAdd}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isPending ? (
          <div
            role="status"
            aria-label="Loading distributions"
            className="space-y-3"
          >
            <p className="text-muted-foreground text-sm">
              Loading distributions…
            </p>
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <DashboardError
            compact
            title="Couldn’t load distributions"
            reset={() => void refetch()}
          />
        ) : (
          <>
            {!conversionReady && (
              <p role="status" className="text-warning text-sm">
                Exchange rate unavailable. Converted totals and charts are
                hidden; recorded distributions remain below.
              </p>
            )}
            {requiresRate && conversionReady && (
              <p className="text-muted-foreground text-sm">
                SGD totals use a current exchange-rate estimate, not the rate on
                each payment date.
              </p>
            )}
            {rows.length > 0 && conversionReady && (
              <DividendIncomeChart
                dividends={rows}
                usdSgdRate={usdSgdRate ?? 1}
              />
            )}

            <DividendTable dividends={rows} onEdit={handleEdit} />

            <div>
              <h3 className="mb-2 text-sm font-semibold">Yield on cost</h3>
              <YieldOnCostTable
                trades={trades}
                dividends={rows}
                usdSgdRate={usdSgdRate}
                asOf={asOf}
              />
            </div>
          </>
        )}
      </CardContent>

      <DividendFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trades={trades}
        editDividend={editDividend}
      />
    </Card>
  );
}

function DistributionScan({
  ready,
  trades,
  existing,
}: {
  ready: boolean;
  trades: EquityTradeData[];
  existing: DividendData[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!ready || trades.length === 0}
      >
        <Sparkles className="size-4" />
        Scan
      </Button>
      {ready && (
        <DividendScanDialog
          open={open}
          onOpenChange={setOpen}
          trades={trades}
          existing={existing}
        />
      )}
    </>
  );
}
