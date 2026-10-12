'use client';

import { useAmountVisibility } from '@/features/privacy';

import { formatCurrency } from '@/lib/utils/currency';

interface FeeBreakdown {
  commission: number;
  platformFee: number;
  clearingFee: number;
  total: number;
}

// Estimated fee breakdown panel. Presentational; the container decides when to
// render it (calculatedFees present and tradeValue > 0).
export function TradeFeeBreakdown({
  fees,
  currency,
}: {
  fees: FeeBreakdown;
  currency: 'SGD' | 'USD';
}) {
  const { mask } = useAmountVisibility();
  return (
    <div className="bg-muted space-y-1 rounded-md p-3 text-xs">
      <p className="text-muted-foreground font-medium">
        Estimated fee breakdown ({currency})
      </p>
      {fees.commission > 0 && (
        <div className="flex-between">
          <span className="text-muted-foreground">Commission</span>
          <span>{mask(formatCurrency(fees.commission, currency))}</span>
        </div>
      )}
      {fees.platformFee > 0 && (
        <div className="flex-between">
          <span className="text-muted-foreground">Platform Fee</span>
          <span>{mask(formatCurrency(fees.platformFee, currency))}</span>
        </div>
      )}
      {fees.clearingFee > 0 && (
        <div className="flex-between">
          <span className="text-muted-foreground">Clearing / SGX Fees</span>
          <span>{mask(formatCurrency(fees.clearingFee, currency))}</span>
        </div>
      )}
      <div className="flex-between border-t pt-1 font-medium">
        <span>Total Fees</span>
        <span>{mask(formatCurrency(fees.total, currency))}</span>
      </div>
    </div>
  );
}

// Trade total-value summary. Presentational; rendered when shares & price > 0.
export function TradeSummary({
  tradeValue,
  fees,
  action,
  currency,
}: {
  tradeValue: number;
  fees: number;
  action: string | undefined;
  currency: 'SGD' | 'USD';
}) {
  const { mask } = useAmountVisibility();
  return (
    <div className="bg-muted rounded-md p-3 text-sm">
      <div className="flex-between">
        <span className="text-muted-foreground">Total Value</span>
        <span className="font-semibold">
          {mask(formatCurrency(tradeValue, currency))}
        </span>
      </div>
      {fees > 0 && (
        <div className="flex-between mt-1">
          <span className="text-muted-foreground">Total incl. Fees</span>
          <span className="font-semibold">
            {mask(
              formatCurrency(
                tradeValue + (action === 'buy' ? 1 : -1) * fees,
                currency
              )
            )}
          </span>
        </div>
      )}
    </div>
  );
}
