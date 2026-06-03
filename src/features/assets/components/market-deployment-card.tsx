'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatSGD } from '@/lib/utils/currency';
import { deployPctColor } from '../lib/investment-math';

export interface MarketCardData {
  label: string;
  quarterly: number;
  spent: number;
  equity: number;
  target: number;
  available: number;
  deployPct: number;
}

interface MarketDeploymentCardProps {
  market: MarketCardData;
  qLabel: string;
  qDaysLeft: number;
  // cashAlloc % for this market (drives the "Target (xx%)" label).
  cashAllocPct: number;
}

// One SG/US market deployment card (quarterly budget + portfolio-target
// progress, availability). Presentational; rendered inside the
// InvestmentBreakdown TooltipProvider. Math arrives precomputed via props.
export function MarketDeploymentCard({
  market: m,
  qLabel,
  qDaysLeft,
  cashAllocPct,
}: MarketDeploymentCardProps) {
  const qPct =
    m.quarterly > 0 ? Math.min((m.spent / m.quarterly) * 100, 100) : 0;
  const targetPct =
    m.target > 0 ? Math.min((m.equity / m.target) * 100, 100) : 0;
  const pctLabel = m.deployPct.toFixed(0);

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex-between text-sm">
        <span className="font-semibold">
          {m.label} — {qLabel}
        </span>
        <span className="text-muted-foreground text-xs">{qDaysLeft}d left</span>
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
                Projected from your monthly salary allocation. Assumes continued
                income for the quarter.
              </p>
              <p className="text-primary-foreground/60 leading-relaxed">
                Spent {formatSGD(m.spent)} of {formatSGD(m.quarterly)} this
                quarter.
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
                Based on cash you can deploy today. Shows current equity vs your
                allocation target.
              </p>
              <p className="text-primary-foreground/60 leading-relaxed">
                Holding {formatSGD(m.equity)} of {formatSGD(m.target)} target.
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
            Target ({cashAllocPct}%)
          </span>
          <span className="font-medium">{formatSGD(m.target)}</span>
        </div>
        <div className="flex-between">
          <span className="text-muted-foreground">Current equity</span>
          <span>{formatSGD(m.equity)}</span>
        </div>
        <div className="flex-between">
          <span className="text-muted-foreground">Quarterly budget</span>
          <span>{formatSGD(m.quarterly)}</span>
        </div>
        <div className="flex-between">
          <span className="text-muted-foreground">Spent this quarter</span>
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
                  {formatSGD(m.available)} of {formatSGD(m.target)} still
                  available.
                </p>
              </TooltipContent>
            </Tooltip>
          </span>
          <span
            className={
              m.available > 0 ? 'text-emerald-600' : 'text-muted-foreground'
            }
          >
            {formatSGD(m.available)}
          </span>
        </div>
      </div>
    </div>
  );
}
