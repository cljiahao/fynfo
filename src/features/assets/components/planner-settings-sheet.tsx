'use client';

import { useAmountVisibility } from '@/features/privacy';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { HORIZON_MAX, HORIZON_MIN } from '../constants';

export interface PlannerSettingsValues {
  emergencyMonths: number;
  warChestMonths: number;
  householdHorizonMonths: number;
  titheEnabled: boolean;
  tithePctInput: number;
  allowanceEnabled: boolean;
  allowancePctInput: number;
}

interface PlannerSettingsSheetProps {
  values: PlannerSettingsValues;
  onChange: (patch: Partial<PlannerSettingsValues>) => void;
  /** Hides the household horizon field for users without a household. */
  showHorizon: boolean;
}

function HorizonField({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (months: number) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(`${value}`);
  return (
    <div className="space-y-1">
      <Label htmlFor="planner-horizon" className="text-xs">
        Household horizon (months)
      </Label>
      <Input
        id="planner-horizon"
        type="number"
        inputMode="numeric"
        min={HORIZON_MIN}
        max={HORIZON_MAX}
        step={1}
        disabled={disabled}
        className="h-8 text-sm"
        value={disabled ? '' : draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const months = Number(e.target.value);
          if (
            Number.isInteger(months) &&
            months >= HORIZON_MIN &&
            months <= HORIZON_MAX
          )
            onCommit(months);
        }}
        onBlur={() => setDraft(`${value}`)}
      />
      <p className="text-muted-foreground text-xs">
        Shared goals due within this many months are reserved up front; later
        ones are spread monthly.
      </p>
    </div>
  );
}

/** Reserves, household horizon and giving: the settings that rarely change. */
export function PlannerSettingsSheet({
  values,
  onChange,
  showHorizon,
}: PlannerSettingsSheetProps) {
  const { hidden, canReveal } = useAmountVisibility();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Adjust settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto p-4 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle>Planner settings</SheetTitle>
          <SheetDescription>
            These change your allocation estimate and save automatically.
          </SheetDescription>
        </SheetHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Savings targets</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="planner-emergency" className="text-xs">
                Emergency Fund (months)
              </Label>
              <Input
                disabled={hidden}
                id="planner-emergency"
                type="number"
                min={1}
                step={1}
                placeholder="3"
                className="h-8 text-sm"
                value={hidden ? '' : values.emergencyMonths || ''}
                onChange={(e) =>
                  canReveal() &&
                  onChange({ emergencyMonths: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="planner-war-chest" className="text-xs">
                War Chest (months)
              </Label>
              <Input
                disabled={hidden}
                id="planner-war-chest"
                type="number"
                min={1}
                step={1}
                placeholder="9"
                className="h-8 text-sm"
                value={hidden ? '' : values.warChestMonths || ''}
                onChange={(e) =>
                  canReveal() &&
                  onChange({ warChestMonths: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          {showHorizon && (
            <HorizonField
              value={values.householdHorizonMonths}
              disabled={hidden}
              onCommit={(months) =>
                canReveal() && onChange({ householdHorizonMonths: months })
              }
            />
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Giving</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Checkbox
                disabled={hidden}
                id="tithe"
                checked={hidden ? false : values.titheEnabled}
                onCheckedChange={(v) =>
                  canReveal() && onChange({ titheEnabled: v === true })
                }
              />
              <Label htmlFor="tithe" className="text-xs">
                Tithe
              </Label>
              <Input
                aria-label="Tithe percentage"
                type="number"
                min="0"
                max="100"
                className="h-6 w-14 text-xs"
                disabled={hidden || !values.titheEnabled}
                value={hidden ? '' : values.tithePctInput || ''}
                onChange={(e) =>
                  canReveal() &&
                  onChange({ tithePctInput: Number(e.target.value) || 0 })
                }
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                disabled={hidden}
                id="allowance"
                checked={hidden ? false : values.allowanceEnabled}
                onCheckedChange={(v) =>
                  canReveal() && onChange({ allowanceEnabled: v === true })
                }
              />
              <Label htmlFor="allowance" className="text-xs">
                Allowance
              </Label>
              <Input
                aria-label="Allowance percentage"
                type="number"
                min="0"
                max="100"
                className="h-6 w-14 text-xs"
                disabled={hidden || !values.allowanceEnabled}
                value={hidden ? '' : values.allowancePctInput || ''}
                onChange={(e) =>
                  canReveal() &&
                  onChange({ allowancePctInput: Number(e.target.value) || 0 })
                }
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
