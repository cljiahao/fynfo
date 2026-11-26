'use client';

import type { PctText } from '../split-utils';
import { SplitPicker } from './split-picker';

/** The split field of the goal form; the form saves it together with the goal. */
export function GoalSplitField({
  memberIds,
  value,
  onChange,
}: {
  memberIds: readonly string[];
  value: PctText;
  onChange: (value: PctText) => void;
}) {
  return (
    <div className="pt-1" data-testid="goal-split">
      <SplitPicker
        label="Who shares this goal"
        memberIds={memberIds}
        value={value}
        onChange={onChange}
      />
      <p className="text-muted-foreground mt-2 text-xs">
        The other members of this goal see this split.
      </p>
    </div>
  );
}
