'use client';

import { Input } from '@/components/ui/input';
import { parseNumericInput } from '@/lib/utils/numeric-input';
import { useState, type ComponentProps } from 'react';

type NumericInputProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type'
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
};

function toRaw(value: number | null): string {
  return value === null ? '' : String(value);
}

// Keeps the raw text while editing so partial input ("1.", ".5") and an empty
// field are never rewritten into a coerced number by the form state.
export function NumericInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: NumericInputProps) {
  const [raw, setRaw] = useState(() => toRaw(value));
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    if (parseNumericInput(raw) !== value) setRaw(toRaw(value));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(event) => {
        const next = event.target.value;
        setRaw(next);
        const parsed = parseNumericInput(next);
        setPrevValue(parsed);
        onValueChange(parsed);
      }}
      onBlur={(event) => {
        setRaw(toRaw(parseNumericInput(raw)));
        onBlur?.(event);
      }}
    />
  );
}
