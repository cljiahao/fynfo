'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { Button } from '@/components/ui/button';
import { PageHeader, PageViews } from '@/components/widgets';
import {
  DistributionsSection,
  EquityTradeData,
  HoldingsTable,
  PortfolioSummary,
  TradeFormDialog,
  TradeTable,
  useTrades,
} from '@/features/equity';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EquitySkeleton } from './equity-skeleton';

export default function EquityPage() {
  const { data: trades, isLoading, isError, refetch } = useTrades();
  const [formOpen, setFormOpen] = useState(false);
  const [editTrade, setEditTrade] = useState<EquityTradeData | undefined>();

  if (isLoading) return <EquitySkeleton />;
  if (isError) return <DashboardError reset={() => void refetch()} />;

  function handleAdd() {
    setEditTrade(undefined);
    setFormOpen(true);
  }

  function handleEdit(trade: EquityTradeData) {
    setEditTrade(trade);
    setFormOpen(true);
  }

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Equity Tracker"
        description="Record and track your stock trades"
        action={
          <Button onClick={handleAdd}>
            <Plus className="mr-2 size-4" />
            Add Trade
          </Button>
        }
      />

      <PageViews
        label="Equity views"
        views={[
          {
            id: 'holdings',
            label: 'Holdings',
            content: (
              <>
                <PortfolioSummary trades={trades ?? []} />
                <HoldingsTable trades={trades ?? []} />
              </>
            ),
          },
          {
            id: 'trades',
            label: 'Trade history',
            content: <TradeTable trades={trades ?? []} onEdit={handleEdit} />,
          },
          {
            id: 'dividends',
            label: 'Dividends',
            content: <DistributionsSection trades={trades ?? []} />,
          },
        ]}
      />

      <TradeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editTrade={editTrade}
      />
    </div>
  );
}
