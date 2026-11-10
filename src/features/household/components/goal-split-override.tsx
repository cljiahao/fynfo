'use client';

import { SplitPicker } from './split-picker';

/** The split field of the goal form; the form saves it together with the goal. */
export function GoalSplitField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pt-1" data-testid="goal-split">
      <SplitPicker
        label="Your share of this goal"
        value={value}
        onChange={onChange}
      />
      <p className="text-muted-foreground mt-2 text-xs">
        Your partner sees this split.
      </p>
    </div>
  );
}
