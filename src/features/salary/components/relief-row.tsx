'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatSGD } from '@/lib/utils/currency';
import { Info } from 'lucide-react';
import { RELIEF_CATALOG } from '../constants';
import type { ReliefState } from '../lib/tax-reliefs';

type ReliefDef = (typeof RELIEF_CATALOG)[number];

// Label + info tooltip, shared by the dialog's auto-computed rows and ReliefRow.
export function ReliefLabel({
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

interface ReliefRowProps {
  def: ReliefDef;
  state: ReliefState | undefined;
  onUpdate: (update: Partial<ReliefState>) => void;
}

// One additional-relief row. Renders the countable / variant / standard variant
// based on the catalog def. Presentational; relief state map lives in the dialog.
export function ReliefRow({ def, state: rawState, onUpdate }: ReliefRowProps) {
  const state = rawState ?? {
    enabled: false,
    amount: def.defaultAmount,
    count: 1,
    variant: def.variants?.[0]?.value ?? '',
  };

  // Countable relief (child)
  if (def.maxCount) {
    return (
      <div className="flex items-center gap-3">
        <Checkbox
          id={`relief-${def.key}`}
          checked={state.enabled}
          onCheckedChange={(v) => {
            const enabled = v === true;
            const count = enabled ? Math.max(state.count, 1) : state.count;
            onUpdate({
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
          <ReliefLabel label={def.label} description={def.description} />
        </Label>
        <Select
          value={String(state.count)}
          disabled={!state.enabled}
          onValueChange={(v) => {
            const count = Number(v);
            onUpdate({ count, amount: def.defaultAmount * count });
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
          {state.enabled ? formatSGD(state.amount) : '—'}
        </span>
      </div>
    );
  }

  // Variant relief (parent)
  if (def.variants) {
    return (
      <div className="flex items-center gap-3">
        <Checkbox
          id={`relief-${def.key}`}
          checked={state.enabled}
          onCheckedChange={(v) => {
            const enabled = v === true;
            const variant = state.variant || def.variants![0].value;
            const matched = def.variants!.find((vr) => vr.value === variant);
            onUpdate({
              enabled,
              variant,
              amount: enabled ? (matched?.amount ?? def.defaultAmount) : 0,
            });
          }}
        />
        <Label
          htmlFor={`relief-${def.key}`}
          className="min-w-0 flex-1 cursor-pointer text-sm"
        >
          <ReliefLabel label={def.label} description={def.description} />
        </Label>
        <Select
          value={state.variant}
          disabled={!state.enabled}
          onValueChange={(v) => {
            const matched = def.variants!.find((vr) => vr.value === v);
            onUpdate({
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
          {state.enabled ? formatSGD(state.amount) : '—'}
        </span>
      </div>
    );
  }

  // Standard relief
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={`relief-${def.key}`}
        checked={state.enabled}
        onCheckedChange={(v) => onUpdate({ enabled: v === true })}
      />
      <div className="flex flex-1 items-center gap-2">
        <Label
          htmlFor={`relief-${def.key}`}
          className="min-w-0 flex-1 cursor-pointer text-sm"
        >
          <ReliefLabel label={def.label} description={def.description} />
        </Label>
        <Input
          type="number"
          min={0}
          className="h-8 w-24 text-sm"
          disabled={!state.enabled}
          value={state.amount || ''}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) || 0 })}
        />
      </div>
    </div>
  );
}
