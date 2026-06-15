'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatSGD } from '@/lib/utils/currency';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDividends } from '../hooks/use-dividends';
import { useExchangeRate } from '../hooks/use-prices';
import { totalSGD } from '../lib/dividend-metrics';
import type { DividendData, EquityTradeData } from '../types';
import { DividendFormDialog } from './dividend-form';
import { DividendIncomeChart } from './dividend-income-chart';
import { DividendTable } from './dividend-table';
import { YieldOnCostTable } from './yield-on-cost-table';

interface DistributionsSectionProps {
  trades: EquityTradeData[];
}

export function DistributionsSection({ trades }: DistributionsSectionProps) {
  const { data: dividends } = useDividends();
  const { data: rate } = useExchangeRate('USD', 'SGD');
  const usdSgdRate = rate ?? 1;
  const rows = useMemo(() => dividends ?? [], [dividends]);

  const [formOpen, setFormOpen] = useState(false);
  const [editDividend, setEditDividend] = useState<DividendData | undefined>();

  const total = totalSGD(rows, usdSgdRate);
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
              {rows.length > 0 ? ` — ${formatSGD(total)} total` : ''}
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {rows.length > 0 && (
          <DividendIncomeChart dividends={rows} usdSgdRate={usdSgdRate} />
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
