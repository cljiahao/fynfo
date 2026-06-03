'use client';

import { Button } from '@/components/ui/button';
import {
  EquityTradeData,
  HoldingsTable,
  PortfolioSummary,
  TradeFormDialog,
  TradeTable,
  useTrades,
} from '@/features/equity';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export function EquityBody() {
  const { data: trades } = useTrades();
  const [formOpen, setFormOpen] = useState(false);
  const [editTrade, setEditTrade] = useState<EquityTradeData | undefined>();

  function handleAdd() {
    setEditTrade(undefined);
    setFormOpen(true);
  }

  function handleEdit(trade: EquityTradeData) {
    setEditTrade(trade);
    setFormOpen(true);
  }

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equity Tracker</h1>
          <p className="text-muted-foreground mt-1">
            Record and track your stock trades
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 size-4" />
          Add Trade
        </Button>
      </div>

      <PortfolioSummary trades={trades ?? []} />

      <HoldingsTable trades={trades ?? []} />

      <TradeTable trades={trades ?? []} onEdit={handleEdit} />

      <TradeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editTrade={editTrade}
      />
    </div>
  );
}
