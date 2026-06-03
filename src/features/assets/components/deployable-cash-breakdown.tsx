'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { formatSGD } from '@/lib/utils/currency';

interface DeployableCashBreakdownProps {
  totalDeployable: number;
  currentSavings: number;
  emergencyFundGoal: number;
  currentBonds: number;
  warChestGoal: number;
  bondsShortfall: number;
  bondsSurplus: number;
  cashAlloc: { sg: number; us: number };
  sgCash: number;
  usCash: number;
  updateCashAlloc: (next: { sg: number; us: number }) => void;
}

// Deployable-cash waterfall + SG/US split inputs. Presentational; cash-alloc
// state lives in the InvestmentBreakdown container. Rendered only when a
// snapshot is present.
export function DeployableCashBreakdown({
  totalDeployable,
  currentSavings,
  emergencyFundGoal,
  currentBonds,
  warChestGoal,
  bondsShortfall,
  bondsSurplus,
  cashAlloc,
  sgCash,
  usCash,
  updateCashAlloc,
}: DeployableCashBreakdownProps) {
  const allocRows = [
    {
      label: 'SG',
      value: cashAlloc.sg,
      amount: sgCash,
      onChange: (v: number) => updateCashAlloc({ sg: v, us: 100 - v }),
    },
    {
      label: 'US',
      value: cashAlloc.us,
      amount: usCash,
      onChange: (v: number) => updateCashAlloc({ sg: 100 - v, us: v }),
    },
  ];

  return (
    <div className="text-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="deployable" className="border-none">
          <AccordionTrigger className="text-muted-foreground p-0 text-xs font-medium">
            Deployable Cash — {formatSGD(totalDeployable)}
          </AccordionTrigger>
          <AccordionContent className="px-0 pt-2 pb-0">
            <div className="space-y-1.5">
              <div className="flex-between text-xs">
                <span>Savings</span>
                <span className="font-medium">{formatSGD(currentSavings)}</span>
              </div>
              <div className="flex-between text-muted-foreground text-xs">
                <span>− Emergency Fund</span>
                <span>{formatSGD(emergencyFundGoal)}</span>
              </div>
              <div className="flex-between text-xs">
                <span>Bonds (war chest)</span>
                <span className="font-medium">{formatSGD(currentBonds)}</span>
              </div>
              <div className="flex-between text-muted-foreground text-xs">
                <span>− War chest goal</span>
                <span>{formatSGD(warChestGoal)}</span>
              </div>
              {bondsShortfall > 0 && (
                <div className="flex-between text-xs text-amber-500">
                  <span>− War chest shortfall</span>
                  <span>{formatSGD(bondsShortfall)}</span>
                </div>
              )}
              {bondsSurplus > 0 && (
                <div className="flex-between text-xs text-emerald-600">
                  <span>+ Bonds surplus</span>
                  <span>{formatSGD(bondsSurplus)}</span>
                </div>
              )}
              <div className="flex-between border-t pt-1.5 font-semibold">
                <span>Total Deployable</span>
                <span
                  className={
                    totalDeployable > 0 ? 'text-emerald-600' : 'text-red-500'
                  }
                >
                  {formatSGD(totalDeployable)}
                </span>
              </div>
            </div>

            {/* Market allocation */}
            {totalDeployable > 0 && (
              <div className="mt-2 space-y-1 border-t pt-1.5">
                {allocRows.map((row) => (
                  <div key={row.label} className="flex-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-6 font-medium">{row.label}</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="h-6 w-16 text-center text-xs"
                        value={row.value || ''}
                        onChange={(e) =>
                          row.onChange(Number(e.target.value) || 0)
                        }
                      />
                      <span className="text-muted-foreground">%</span>
                    </span>
                    <span className="font-semibold">
                      {formatSGD(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
