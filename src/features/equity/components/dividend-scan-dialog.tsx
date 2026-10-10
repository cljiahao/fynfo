'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/widgets';
import { Coins, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fetchDividends } from '../actions/price-actions';
import { MAX_PRICE_CONCURRENCY } from '../constants';
import { useCreateDividends } from '../hooks/use-dividends';
import {
  buildDividendCandidates,
  dividendScanTickers,
  type DividendCandidate,
} from '../lib/dividend-scan';

import type { DividendData, EquityTradeData } from '../types';

interface DividendScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trades: EquityTradeData[];
  existing: DividendData[];
}

interface ScanRow extends DividendCandidate {
  selected: boolean;
}

export function DividendScanDialog({
  open,
  onOpenChange,
  trades,
  existing,
}: DividendScanDialogProps) {
  const createMany = useCreateDividends();
  const [scanning, setScanning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<ScanRow[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function scan() {
      setScanning(true);
      setScanFailed(false);
      setRows([]);
      try {
        const tickers = dividendScanTickers(trades);
        const pointsByTicker: Parameters<typeof buildDividendCandidates>[1] =
          {};
        let cursor = 0;
        let failed = false;
        async function worker() {
          while (!cancelled && !failed && cursor < tickers.length) {
            const ticker = tickers[cursor++];
            try {
              pointsByTicker[ticker] = await fetchDividends(ticker);
            } catch (error) {
              failed = true;
              throw error;
            }
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(MAX_PRICE_CONCURRENCY, tickers.length) },
            worker
          )
        );
        if (cancelled) return;
        const candidates = buildDividendCandidates(
          trades,
          pointsByTicker,
          existing
        );
        if (!cancelled) {
          setRows(candidates.map((c) => ({ ...c, selected: true })));
        }
      } catch {
        if (!cancelled) {
          setScanFailed(true);
          toast.error('Could not scan for distributions');
        }
      } finally {
        if (!cancelled) setScanning(false);
      }
    }

    void scan();
    return () => {
      cancelled = true;
    };
  }, [open, trades, existing, attempt]);

  const selectedCount = rows.filter((r) => r.selected).length;

  function toggle(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  }

  function setAmount(index: number, amount: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, amount } : r)));
  }

  async function handleImport() {
    const toAdd = rows
      .filter((r) => r.selected && Number.isFinite(r.amount) && r.amount > 0)
      .map((r) => ({
        ticker: r.ticker,
        date: r.date,
        amount: r.amount,
        currency: r.currency,
      }));
    if (toAdd.length === 0) {
      toast.error('Select at least one distribution');
      return;
    }
    try {
      await createMany.mutateAsync(toAdd);
      toast.success(`Imported ${toAdd.length} distributions`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to import distributions');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scan distributions</DialogTitle>
          <DialogDescription>
            Gross estimates from your trade history and the last five years of
            market data, including sold positions. Shares use trades before each
            ex-date. Dates are ex-dates, not confirmed payment dates. Review
            amounts against your received payments.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Scanning your trade history…
          </div>
        ) : scanFailed ? (
          <div
            role="alert"
            aria-label="Couldn’t scan distributions"
            className="space-y-3 py-10 text-center"
          >
            <p className="font-medium">Couldn’t scan distributions</p>
            <p className="text-muted-foreground text-sm">
              Market data is unavailable. Try again before reviewing estimates.
            </p>
            <Button
              variant="outline"
              onClick={() => setAttempt((current) => current + 1)}
            >
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="No new distributions found"
            description="No eligible new estimates in the returned market data. Compare against your received payments; source coverage may be incomplete."
            className="border-0"
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-8 py-2" />
                  <th className="py-2 text-left font-medium">Ticker</th>
                  <th className="py-2 text-left font-medium">Ex-date</th>
                  <th className="py-2 text-right font-medium">Shares</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.ticker}-${r.date}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-2">
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={() => toggle(i)}
                        aria-label={`Include ${r.ticker} ${r.date}`}
                      />
                    </td>
                    <td className="py-2 font-medium">{r.ticker}</td>
                    <td className="py-2">{r.date}</td>
                    <td className="py-2 text-right tabular-nums">{r.shares}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.amount}
                          onChange={(e) =>
                            setAmount(i, Number(e.target.value) || 0)
                          }
                          className="h-8 w-24 text-right"
                          aria-label={`Amount for ${r.ticker} ${r.date}`}
                        />
                        <span className="text-muted-foreground text-xs">
                          {r.currency}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Button
              onClick={handleImport}
              disabled={createMany.isPending || selectedCount === 0}
            >
              {createMany.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Add {selectedCount} selected
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
