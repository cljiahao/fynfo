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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RELIEF_CATALOG } from '../constants';
import { useTaxReliefs, useUpsertTaxReliefs } from '../hooks/use-tax-reliefs';
import type { TaxReliefData } from '../types';
import type { ReliefItem } from './salary-summary';

interface ReliefState {
  enabled: boolean;
  amount: number;
  count: number;
  variant: string;
}

type ReliefStateMap = Map<string, ReliefState>;

interface TaxReliefsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earnedIncomeRelief: number;
  nsmanRelief: number;
  isNonResident: boolean;
  onConfirm?: (items: ReliefItem[]) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value);

const buildInitialState = (saved: TaxReliefData[] | null): ReliefStateMap => {
  const map = new Map<string, ReliefState>();
  for (const def of RELIEF_CATALOG) {
    const match = saved?.find((r) => r.reliefKey === def.key);
    const savedAmount = match?.amount ?? 0;

    let count = 1;
    let variant = def.variants?.[0]?.value ?? '';

    if (match) {
      if (def.maxCount) {
        count = Math.max(Math.round(savedAmount / def.defaultAmount), 1);
      }
      if (def.variants) {
        const matched = def.variants.find((v) => v.amount === savedAmount);
        variant = matched?.value ?? def.variants[0]?.value ?? '';
      }
    }

    map.set(def.key, {
      enabled: !!match,
      amount: match ? savedAmount : def.defaultAmount,
      count,
      variant,
    });
  }
  return map;
};

const buildReliefItems = (state: ReliefStateMap): ReliefItem[] => {
  const items: ReliefItem[] = [];
  for (const def of RELIEF_CATALOG) {
    const s = state.get(def.key);
    if (!s?.enabled) continue;

    let label = def.label;
    if (def.maxCount && s.count > 1) {
      label = `${def.label} (×${s.count})`;
    }
    if (def.variants) {
      const matched = def.variants.find((v) => v.value === s.variant);
      if (matched) label = `${def.label} — ${matched.label}`;
    }

    items.push({ label, amount: s.amount });
  }
  return items;
};

const computeTotal = (state: ReliefStateMap) => {
  let total = 0;
  state.forEach((v) => {
    if (v.enabled) total += v.amount;
  });
  return total;
};

function ReliefLabel({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="text-muted-foreground size-3.5 shrink-0 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">
          {description}
        </TooltipContent>
      </Tooltip>
    </span>
  );
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
                      {formatCurrency(earnedIncomeRelief)}
                    </span>
                  </div>
                  <div className="flex-between text-sm">
                    <ReliefLabel
                      label="NSMan Relief"
                      description="SGD 1,500 for operationally ready NSmen. Enable in your profile if you completed National Service."
                    />
                    <span className="font-medium">
                      {nsmanRelief > 0 ? formatCurrency(nsmanRelief) : '—'}
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
                  {RELIEF_CATALOG.map((def) => {
                    const state = reliefState.get(def.key) ?? {
                      enabled: false,
                      amount: def.defaultAmount,
                      count: 1,
                      variant: def.variants?.[0]?.value ?? '',
                    };

                    // Countable relief (child)
                    if (def.maxCount) {
                      return (
                        <div key={def.key} className="flex items-center gap-3">
                          <Checkbox
                            id={`relief-${def.key}`}
                            checked={state.enabled}
                            onCheckedChange={(v) => {
                              const enabled = v === true;
                              const count = enabled
                                ? Math.max(state.count, 1)
                                : state.count;
                              updateRelief(def.key, {
                                enabled,
                                count,
                                amount: enabled ? def.defaultAmount * count : 0,
                              });
                            }}
                          />
                          <Label
                            htmlFor={`relief-${def.key}`}
                            className="min-w-0 flex-1 cursor-pointer text-sm"
                          >
                            <ReliefLabel
                              label={def.label}
                              description={def.description}
                            />
                          </Label>
                          <Select
                            value={String(state.count)}
                            disabled={!state.enabled}
                            onValueChange={(v) => {
                              const count = Number(v);
                              updateRelief(def.key, {
                                count,
                                amount: def.defaultAmount * count,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-20 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: def.maxCount }, (_, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>
                                  {i + 1}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground w-24 text-right text-sm tabular-nums">
                            {state.enabled ? formatCurrency(state.amount) : '—'}
                          </span>
                        </div>
                      );
                    }

                    // Variant relief (parent)
                    if (def.variants) {
                      return (
                        <div key={def.key} className="flex items-center gap-3">
                          <Checkbox
                            id={`relief-${def.key}`}
                            checked={state.enabled}
                            onCheckedChange={(v) => {
                              const enabled = v === true;
                              const variant =
                                state.variant || def.variants![0].value;
                              const matched = def.variants!.find(
                                (vr) => vr.value === variant
                              );
                              updateRelief(def.key, {
                                enabled,
                                variant,
                                amount: enabled
                                  ? (matched?.amount ?? def.defaultAmount)
                                  : 0,
                              });
                            }}
                          />
                          <Label
                            htmlFor={`relief-${def.key}`}
                            className="min-w-0 flex-1 cursor-pointer text-sm"
                          >
                            <ReliefLabel
                              label={def.label}
                              description={def.description}
                            />
                          </Label>
                          <Select
                            value={state.variant}
                            disabled={!state.enabled}
                            onValueChange={(v) => {
                              const matched = def.variants!.find(
                                (vr) => vr.value === v
                              );
                              updateRelief(def.key, {
                                variant: v,
                                amount: matched?.amount ?? def.defaultAmount,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-40 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {def.variants.map((v) => (
                                <SelectItem key={v.value} value={v.value}>
                                  {v.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground w-24 text-right text-sm tabular-nums">
                            {state.enabled ? formatCurrency(state.amount) : '—'}
                          </span>
                        </div>
                      );
                    }

                    // Standard relief
                    return (
                      <div key={def.key} className="flex items-center gap-3">
                        <Checkbox
                          id={`relief-${def.key}`}
                          checked={state.enabled}
                          onCheckedChange={(v) =>
                            updateRelief(def.key, { enabled: v === true })
                          }
                        />
                        <div className="flex flex-1 items-center gap-2">
                          <Label
                            htmlFor={`relief-${def.key}`}
                            className="min-w-0 flex-1 cursor-pointer text-sm"
                          >
                            <ReliefLabel
                              label={def.label}
                              description={def.description}
                            />
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-24 text-sm"
                            disabled={!state.enabled}
                            value={state.amount || ''}
                            onChange={(e) =>
                              updateRelief(def.key, {
                                amount: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex-between text-sm font-semibold">
                <span>Total Tax Reliefs</span>
                <span>{formatCurrency(grandTotal)}</span>
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
