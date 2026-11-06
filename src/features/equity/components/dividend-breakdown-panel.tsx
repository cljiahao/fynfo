'use client';

import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole, formatUSD } from '@/lib/utils/currency';
import type { CurrencySplit, TickerBreakdown } from '../lib/dividend-breakdown';

interface DividendBreakdownPanelProps {
  /** Null while holdings are unavailable; yield on cost needs them. */
  breakdown: TickerBreakdown | null;
  forward: number | null;
  /** Fraction of monthly expenses covered; null hides the line. */
  coverage: number | null;
  split: CurrencySplit;
}

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

// A native progress element carries the share, so the bar needs no inline width.
function ShareRow({
  label,
  ttm,
  share,
  caption,
}: {
  label: string;
  ttm: number;
  share: number;
  caption?: string;
}) {
  const { mask } = useAmountVisibility();
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{label}</span>
        <span className="text-sm tabular-nums">
          {mask(formatSGDWhole(ttm))}{' '}
          <span className="text-muted-foreground">({pct(share)})</span>
        </span>
      </div>
      <progress
        aria-label={`${label} share of dividends`}
        value={Math.round(share * 100)}
        max={100}
        className="[&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-chart-2 [&::-moz-progress-bar]:bg-chart-2 bg-muted h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-value]:rounded-full"
      />
      {caption !== undefined && (
        <p className="text-muted-foreground text-xs">{caption}</p>
      )}
    </li>
  );
}

export function DividendBreakdownPanel({
  breakdown,
  forward,
  coverage,
  split,
}: DividendBreakdownPanelProps) {
  const { mask } = useAmountVisibility();
  return (
    <div className="space-y-4">
      {breakdown !== null && breakdown.tickers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Top tickers, last 12 months</h3>
          <ul className="space-y-3">
            {breakdown.tickers.map((t) => (
              <ShareRow
                key={t.ticker}
                label={t.ticker}
                ttm={t.ttm}
                share={t.share}
                caption={`Yield on cost ${
                  t.yieldOnCost === null
                    ? '—'
                    : `${(t.yieldOnCost * 100).toFixed(1)}%`
                }`}
              />
            ))}
            {breakdown.other !== null && (
              <ShareRow
                label={`Other (${breakdown.other.tickerCount})`}
                ttm={breakdown.other.ttm}
                share={breakdown.other.share}
              />
            )}
          </ul>
        </div>
      )}
      {forward !== null && (
        <p className="text-sm">
          Estimated next 12 months:{' '}
          <span className="font-medium tabular-nums">
            {mask(formatSGDWhole(forward))}
          </span>
          <span className="text-muted-foreground block text-xs">
            Estimate: assumes the last 12 months repeat for current holdings.
          </span>
        </p>
      )}
      {coverage !== null && (
        <p className="text-sm">
          Dividends cover{' '}
          <span className="font-medium tabular-nums">
            {mask(pct(coverage))}
          </span>{' '}
          of planned monthly expenses.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        {mask(
          `SGD ${formatSGDWhole(split.sgd)} · USD ${formatSGDWhole(split.usdInSgd)} (${formatUSD(split.usdNative)} received)`
        )}
      </p>
    </div>
  );
}
