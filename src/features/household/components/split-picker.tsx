'use client';

import { Button } from '@/components/ui/button';
import { useId, useState } from 'react';
import { useMemberLabels } from '../hooks/use-member-labels';
import {
  distributePct,
  parsePctMap,
  pctMapToText,
  type PctText,
} from '../split-utils';
import { MemberPctFields } from './member-pct-fields';

/**
 * Edits how one household item is split across `memberIds`. The default is an
 * even split over the members ticked as sharing it; Custom sets a percentage
 * per member. Presets are manual because members' salaries are not visible,
 * so no income-based split can be offered.
 */
export function SplitPicker({
  label,
  memberIds,
  value,
  onChange,
}: {
  label: string;
  /** Members the item can be split across. */
  memberIds: readonly string[];
  /** Percent per member as typed; a member at 0 is not sharing the item. */
  value: PctText;
  onChange: (value: PctText) => void;
}) {
  const labelId = useId();
  const { label: nameOf } = useMemberLabels();
  const [customOpen, setCustomOpen] = useState(false);
  const parsed = parsePctMap(value, memberIds);
  const sharing = memberIds.filter((id) => Number(value[id] ?? 0) > 0);
  const evenText = pctMapToText(distributePct(sharing), memberIds);
  const isEven = memberIds.every((id) => value[id] === evenText[id]);
  const custom = customOpen || !isEven;

  const toggle = (id: string) => {
    const next = sharing.includes(id)
      ? sharing.filter((other) => other !== id)
      : [...sharing, id];
    if (next.length === 0) return;
    setCustomOpen(false);
    onChange(pctMapToText(distributePct(next), memberIds));
  };

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {memberIds.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={sharing.includes(id) ? 'default' : 'outline'}
            aria-pressed={sharing.includes(id)}
            onClick={() => toggle(id)}
          >
            {nameOf(id)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={custom ? 'default' : 'outline'}
          aria-pressed={custom}
          onClick={() => {
            if (custom) {
              setCustomOpen(false);
              onChange(pctMapToText(distributePct(memberIds), memberIds));
            } else setCustomOpen(true);
          }}
        >
          Custom
        </Button>
      </div>
      {custom ? (
        <MemberPctFields
          memberIds={memberIds}
          value={value}
          onChange={onChange}
        />
      ) : (
        parsed && (
          <p className="text-muted-foreground text-sm tabular-nums">
            {memberIds
              .filter((id) => parsed[id] > 0)
              .map((id) => `${nameOf(id)} ${parsed[id]}%`)
              .join(', ')}
          </p>
        )
      )}
    </div>
  );
}
