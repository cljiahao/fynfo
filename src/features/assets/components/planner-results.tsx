'use client';

import { ColorSwatch } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CHART_TOOLTIP_PROPS,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from '@/lib/recharts';
import { formatSGD } from '@/lib/utils/currency';

interface PieDatum {
  name: string;
  value: number;
  fill: string;
}

interface BreakdownItem {
  label: string;
  value: number;
  color: string;
}

interface PlannerResultsProps {
  idPrefix?: string;
  pieData: PieDatum[];
  netAfterCpf: number;
  breakdownItems: BreakdownItem[];
  titheEnabled: boolean;
  setTitheEnabled: (v: boolean) => void;
  tithePctInput: number;
  setTithePctInput: (v: number) => void;
  allowanceEnabled: boolean;
  setAllowanceEnabled: (v: boolean) => void;
  allowancePctInput: number;
  setAllowancePctInput: (v: number) => void;
  expenses: number;
  emergencyMonths: number;
  warChestMonths: number;
  emergencyFundGoal: number;
  warChestGoal: number;
  currentSavings: number;
  currentBonds: number;
  goalsFulfilled: boolean;
}

// Allocation pie + breakdown/goals panel (shown when salary > 0).
// Presentational; tithe/allowance toggles write back via setters.
export function PlannerResults({
  idPrefix = '',
  pieData,
  netAfterCpf,
  breakdownItems,
  titheEnabled,
  setTitheEnabled,
  tithePctInput,
  setTithePctInput,
  allowanceEnabled,
  setAllowanceEnabled,
  allowancePctInput,
  setAllowancePctInput,
  expenses,
  emergencyMonths,
  warChestMonths,
  emergencyFundGoal,
  warChestGoal,
  currentSavings,
  currentBonds,
  goalsFulfilled,
}: PlannerResultsProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Pie chart */}
      <div className="h-[250px] w-full">
        {hidden ? (
          <p role="status">Amounts hidden</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
                className="cursor-default outline-none"
              />
              <Tooltip
                formatter={(value: unknown) => {
                  const amt = Number(value);
                  const pct = netAfterCpf > 0 ? (amt / netAfterCpf) * 100 : 0;
                  return `${mask(formatSGD(amt))} (${pct.toFixed(1)}%)`;
                }}
                {...CHART_TOOLTIP_PROPS}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown + Goals */}
      <div className="space-y-4">
        {/* Optional deductions */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <Checkbox
              disabled={hidden}
              id={idPrefix ? `${idPrefix}-tithe` : 'tithe'}
              checked={hidden ? false : titheEnabled}
              onCheckedChange={(v) =>
                canReveal() && setTitheEnabled(v === true)
              }
            />
            <Label
              htmlFor={idPrefix ? `${idPrefix}-tithe` : 'tithe'}
              className="text-xs"
            >
              Tithe
            </Label>
            <Input
              aria-label="Tithe percentage"
              type="number"
              min="0"
              max="100"
              className="h-6 w-14 text-xs"
              disabled={hidden || !titheEnabled}
              value={hidden ? '' : tithePctInput || ''}
              onChange={(e) =>
                canReveal() && setTithePctInput(Number(e.target.value) || 0)
              }
            />
            <span className="text-muted-foreground text-xs">%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox
              disabled={hidden}
              id={idPrefix ? `${idPrefix}-allowance` : 'allowance'}
              checked={hidden ? false : allowanceEnabled}
              onCheckedChange={(v) =>
                canReveal() && setAllowanceEnabled(v === true)
              }
            />
            <Label
              htmlFor={idPrefix ? `${idPrefix}-allowance` : 'allowance'}
              className="text-xs"
            >
              Allowance
            </Label>
            <Input
              aria-label="Allowance percentage"
              type="number"
              min="0"
              max="100"
              className="h-6 w-14 text-xs"
              disabled={hidden || !allowanceEnabled}
              value={hidden ? '' : allowancePctInput || ''}
              onChange={(e) =>
                canReveal() && setAllowancePctInput(Number(e.target.value) || 0)
              }
            />
            <span className="text-muted-foreground text-xs">%</span>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex-between">
            <span className="text-muted-foreground">Net (after CPF)</span>
            <span className="font-medium">{mask(formatSGD(netAfterCpf))}</span>
          </div>
          {breakdownItems.map((item) => (
            <div key={item.label} className="flex-between">
              <span className="flex items-center gap-1.5">
                <ColorSwatch color={item.color} />
                {hidden ? item.label.split(' (')[0] : item.label}
              </span>
              <span
                className={
                  !hidden && item.value < 0
                    ? 'text-loss font-medium'
                    : 'font-medium'
                }
              >
                {mask(formatSGD(item.value))}
              </span>
            </div>
          ))}
        </div>

        {expenses > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">
              Savings Goals
            </p>
            <div className="flex-between text-sm">
              <span>Emergency Fund ({mask(emergencyMonths)}mo)</span>
              <span className="font-semibold">
                {mask(formatSGD(emergencyFundGoal))}
              </span>
            </div>
            <div className="flex-between text-sm">
              <span className="text-muted-foreground text-xs">
                Current (Savings)
              </span>
              <span
                className={`text-xs ${hidden ? 'text-muted-foreground' : currentSavings >= emergencyFundGoal ? 'text-gain' : 'text-warning'}`}
              >
                {mask(formatSGD(currentSavings))}{' '}
                {hidden
                  ? ''
                  : currentSavings >= emergencyFundGoal
                    ? '✓'
                    : `(need ${mask(formatSGD(emergencyFundGoal - currentSavings))})`}
              </span>
            </div>
            <div className="flex-between text-sm">
              <span>War Chest ({mask(warChestMonths)}mo)</span>
              <span className="font-semibold">
                {mask(formatSGD(warChestGoal))}
              </span>
            </div>
            <div className="flex-between text-sm">
              <span className="text-muted-foreground text-xs">
                Current (Bonds)
              </span>
              <span
                className={`text-xs ${hidden ? 'text-muted-foreground' : currentBonds >= warChestGoal ? 'text-gain' : 'text-warning'}`}
              >
                {mask(formatSGD(currentBonds))}{' '}
                {hidden
                  ? ''
                  : currentBonds >= warChestGoal
                    ? '✓'
                    : `(need ${mask(formatSGD(warChestGoal - currentBonds))})`}
              </span>
            </div>
            {!hidden && goalsFulfilled && (
              <p className="text-gain text-xs font-medium">
                All goals fulfilled — surplus goes to investment
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
