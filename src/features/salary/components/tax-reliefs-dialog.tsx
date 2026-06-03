'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { formatSGD } from '@/lib/utils/currency';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RELIEF_CATALOG } from '../constants';
import { useTaxReliefs, useUpsertTaxReliefs } from '../hooks/use-tax-reliefs';
import {
  buildInitialState,
  buildReliefItems,
  computeTotal,
  type ReliefState,
  type ReliefStateMap,
} from '../lib/tax-reliefs';
import type { TaxReliefData } from '../types';
import { ReliefLabel, ReliefRow } from './relief-row';
import type { ReliefItem } from './salary-summary';

interface TaxReliefsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earnedIncomeRelief: number;
  nsmanRelief: number;
  isNonResident: boolean;
  onConfirm?: (items: ReliefItem[]) => void;
}

function TaxReliefsDialogInner({
  open,
  onOpenChange,
  earnedIncomeRelief,
  nsmanRelief,
  isNonResident,
  onConfirm,
  initialState,
  year,
}: TaxReliefsDialogProps & { initialState: ReliefStateMap; year: number }) {
  const upsertReliefs = useUpsertTaxReliefs(year);
  const [reliefState, setReliefState] = useState(initialState);

  // Notify parent of initial items on mount
  const notifiedRef = useRef<boolean | null>(null);
  if (notifiedRef.current == null) {
    notifiedRef.current = true;
    queueMicrotask(() => onConfirm?.(buildReliefItems(initialState)));
  }

  // Stable mutate ref
  const mutateRef = useRef(upsertReliefs.mutate);
  useEffect(() => {
    mutateRef.current = upsertReliefs.mutate;
  });

  const updateRelief = (key: string, update: Partial<ReliefState>) => {
    setReliefState((prev) => {
      const next = new Map(prev);
      const current = next.get(key) ?? {
        enabled: false,
        amount: 0,
        count: 1,
        variant: '',
      };
      next.set(key, { ...current, ...update });
      return next;
    });
  };

  const handleConfirm = () => {
    // Save to DB
    const reliefs: TaxReliefData[] = [];
    reliefState.forEach((v, key) => {
      if (v.enabled) {
        reliefs.push({ reliefKey: key, amount: v.amount });
      }
    });
    mutateRef.current(reliefs);

    // Notify parent with named items
    onConfirm?.(buildReliefItems(reliefState));

    onOpenChange(false);
  };

  const additionalTotal = computeTotal(reliefState);
  const grandTotal = earnedIncomeRelief + nsmanRelief + additionalTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tax Reliefs ({year})</DialogTitle>
          <DialogDescription>
            {isNonResident
              ? 'Non-residents are not eligible for personal tax reliefs.'
              : 'Select your applicable reliefs and confirm to update your tax calculation.'}
          </DialogDescription>
        </DialogHeader>

        {isNonResident ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Non-resident flat rate 22% applies — no personal reliefs.
          </p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-4">
              {/* Auto-computed reliefs */}
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Auto-computed (from profile)
                </p>
                <div className="space-y-2">
                  <div className="flex-between text-sm">
                    <ReliefLabel
                      label="Earned Income Relief"
                      description="Based on your age from profile. Below 55: SGD 1,000 / 55–59: SGD 6,000 / 60+: SGD 8,000."
                    />
                    <span className="font-medium">
                      {formatSGD(earnedIncomeRelief)}
                    </span>
                  </div>
                  <div className="flex-between text-sm">
                    <ReliefLabel
                      label="NSMan Relief"
                      description="SGD 1,500 for operationally ready NSmen. Enable in your profile if you completed National Service."
                    />
                    <span className="font-medium">
                      {nsmanRelief > 0 ? formatSGD(nsmanRelief) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Additional reliefs */}
              <div>
                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                  Additional Reliefs
                </p>
                <div className="space-y-3">
                  {RELIEF_CATALOG.map((def) => (
                    <ReliefRow
                      key={def.key}
                      def={def}
                      state={reliefState.get(def.key)}
                      onUpdate={(update) => updateRelief(def.key, update)}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex-between text-sm font-semibold">
                <span>Total Tax Reliefs</span>
                <span>{formatSGD(grandTotal)}</span>
              </div>

              {/* Confirm */}
              <div className="flex justify-end">
                <Button
                  onClick={handleConfirm}
                  disabled={upsertReliefs.isPending}
                >
                  {upsertReliefs.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Confirm
                </Button>
              </div>
            </div>
          </TooltipProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TaxReliefsDialog(props: TaxReliefsDialogProps) {
  const currentYear = new Date().getFullYear();
  const { data: savedReliefs, isLoading } = useTaxReliefs(currentYear);

  if (isLoading) return null;

  return (
    <TaxReliefsDialogInner
      {...props}
      initialState={buildInitialState(savedReliefs ?? null)}
      year={currentYear}
    />
  );
}
