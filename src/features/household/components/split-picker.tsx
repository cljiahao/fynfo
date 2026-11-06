'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useId, useState } from 'react';
import { parsePct } from '../split-utils';

const PRESETS = [
  { id: 'even', label: '50/50', pct: '50' },
  { id: 'me', label: 'Just me', pct: '100' },
  { id: 'partner', label: 'Just partner', pct: '0' },
] as const;

type PresetId = (typeof PRESETS)[number]['id'] | 'custom';

function presetFor(value: string): PresetId {
  return PRESETS.find((preset) => preset.pct === value.trim())?.id ?? 'custom';
}

/**
 * Edits the caller's percentage of one household item. Presets are manual
 * percentages because the partner's salary is not visible, so no income-based
 * split can be offered.
 */
export function SplitPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  /** The caller's percent as typed; blank or out of range is invalid. */
  value: string;
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  const [customOpen, setCustomOpen] = useState(false);
  const pct = parsePct(value);
  const selected = customOpen ? 'custom' : presetFor(value);

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={selected === preset.id ? 'default' : 'outline'}
            aria-pressed={selected === preset.id}
            onClick={() => {
              setCustomOpen(false);
              onChange(preset.pct);
            }}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={selected === 'custom' ? 'default' : 'outline'}
          aria-pressed={selected === 'custom'}
          onClick={() => setCustomOpen(true)}
        >
          Custom
        </Button>
      </div>
      {selected === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            aria-label="Your share (%)"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={value}
            aria-invalid={pct === null ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
            className="w-24 text-right tabular-nums"
          />
          <span className="text-muted-foreground text-sm tabular-nums">
            Partner: {pct === null ? '-' : 100 - pct}%
          </span>
        </div>
      )}
      {selected !== 'custom' && pct !== null && (
        <p className="text-muted-foreground text-sm tabular-nums">
          You {pct}%, partner {100 - pct}%
        </p>
      )}
      {pct === null && (
        <p role="alert" className="text-destructive text-sm">
          Enter a whole number from 0 to 100
        </p>
      )}
    </div>
  );
}
