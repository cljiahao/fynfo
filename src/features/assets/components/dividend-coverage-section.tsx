import {
  DEFAULT_DIVIDEND_SPEND_SHARE_PCT,
  DEFAULT_DIVIDEND_SPEND_THRESHOLD_PCT,
  DIVIDEND_COVERAGE_MILESTONES,
} from '../constants';
import {
  computeDividendAllowance,
  computeDividendCoverage,
} from '../lib/dividend-coverage';

interface DividendCoverageSectionProps {
  ttmMonthlyAvg: number | null;
  /** Living cost a month: expenses, buffer and household budgets. */
  monthlyLivingCost: number;
  money: (value: number) => string;
}

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function DividendCoverageSection({
  ttmMonthlyAvg,
  monthlyLivingCost,
  money,
}: DividendCoverageSectionProps) {
  const { coverage, reached, next, gapTtmSgd } = computeDividendCoverage({
    ttmMonthlyAvg,
    monthlyExpenses: monthlyLivingCost,
  });
  if (coverage === null) return null;

  const allowance = computeDividendAllowance({
    ttmMonthlyAvg,
    coverage,
    thresholdPct: DEFAULT_DIVIDEND_SPEND_THRESHOLD_PCT,
    sharePct: DEFAULT_DIVIDEND_SPEND_SHARE_PCT,
  });

  return (
    <div className="space-y-1" data-testid="dividend-coverage">
      <p>Dividends cover {pct(coverage)} of living cost.</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Dividend milestones">
        {DIVIDEND_COVERAGE_MILESTONES.map((milestone) => {
          const isReached = reached !== null && milestone <= reached;
          const isNext = milestone === next;
          return (
            <li
              key={milestone}
              data-state={isReached ? 'reached' : isNext ? 'next' : 'pending'}
              className={
                isReached
                  ? 'bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs'
                  : isNext
                    ? 'border-primary rounded-full border px-2 py-0.5 text-xs'
                    : 'text-muted-foreground rounded-full border px-2 py-0.5 text-xs'
              }
            >
              {pct(milestone)}
              {isReached ? ' reached' : isNext ? ' next' : ''}
            </li>
          );
        })}
      </ul>
      {next !== null && gapTtmSgd !== null ? (
        <p className="text-muted-foreground">
          {gapTtmSgd > 0
            ? `${money(gapTtmSgd)} more dividends a year reaches ${pct(next)}.`
            : `Next milestone: ${pct(next)}.`}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Dividends cover your living cost.
        </p>
      )}
      {allowance !== null && allowance.monthlyAllowance > 0 && (
        <p>
          You may spend up to {money(allowance.monthlyAllowance)} a month from
          dividends; the rest ({money(allowance.monthlyReinvest)}) is
          reinvested.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Estimates from your logged dividends, not advice.
      </p>
    </div>
  );
}
