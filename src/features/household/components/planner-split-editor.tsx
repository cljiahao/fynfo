'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  usePlannerSplit,
  useSetPlannerSplit,
} from '../hooks/use-planner-split';
import { parsePctMap, pctMapToText, type PctText } from '../split-utils';
import type { PlannerSplit } from '../types';
import { MemberPctFields } from './member-pct-fields';

function SplitForm({ split }: { split: PlannerSplit }) {
  const save = useSetPlannerSplit();
  const memberIds = Object.keys(split.members).sort();
  const [text, setText] = useState<PctText>(() =>
    pctMapToText(split.members, memberIds)
  );
  const parsed = parsePctMap(text, memberIds);

  if (memberIds.length < 2) return null;

  const onSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed) return;
    save.mutate(
      { members: parsed },
      {
        onSuccess: () => toast.success('Split saved'),
        onError: () => toast.error('Could not save the split, try again'),
      }
    );
  };

  return (
    <form
      onSubmit={onSave}
      className="space-y-3 rounded-xl border p-4"
      aria-label="Household split"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Default split for new items</p>
        {split.isDefault && (
          <span className="text-muted-foreground text-xs">
            Default even split, not set yet
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        The split each new goal or budget starts with. Existing items keep their
        own split, set in their form. The other members see any change you make
        here.
      </p>
      <MemberPctFields memberIds={memberIds} value={text} onChange={setText} />
      <Button type="submit" disabled={!parsed || save.isPending}>
        Save split
      </Button>
    </form>
  );
}

/**
 * One line, "You pay 50%", that opens the default-split form on tap so the
 * page stays quiet until someone wants to change it.
 */
export function PlannerSplitEditor() {
  const split = usePlannerSplit();
  const [open, setOpen] = useState(false);
  if (!split.data) return null;
  const mine = split.data.members[split.data.userId] ?? 50;
  // Remount on server change so the field follows the saved or member-edited value.
  const key = JSON.stringify(split.data.members);
  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="h-auto min-h-10 px-0 py-1 font-normal"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        You pay {mine}%
        <span className="text-muted-foreground ml-2 text-xs">
          {open ? 'Hide split' : 'Change split'}
        </span>
        {/* The open form carries its own default notice. */}
        {!open && split.data.isDefault && (
          <span className="text-muted-foreground ml-2 text-xs">
            (not set yet)
          </span>
        )}
      </Button>
      {open && <SplitForm key={key} split={split.data} />}
    </div>
  );
}
