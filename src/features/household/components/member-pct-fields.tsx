'use client';

import { Input } from '@/components/ui/input';
import { useMemberLabels } from '../hooks/use-member-labels';
import { parsePct, pctRemainder, type PctText } from '../split-utils';

/**
 * One percent field per member plus the points still unassigned, so a split
 * across any number of members can be balanced to 100 while typing.
 */
export function MemberPctFields({
  memberIds,
  value,
  onChange,
}: {
  memberIds: readonly string[];
  value: PctText;
  onChange: (value: PctText) => void;
}) {
  const { label } = useMemberLabels();
  const remainder = pctRemainder(value, memberIds);
  const invalid = memberIds.some((id) => parsePct(value[id] ?? '') === null);

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {memberIds.map((id) => {
          const pct = parsePct(value[id] ?? '');
          return (
            <li key={id} className="flex items-center gap-2">
              <Input
                aria-label={`${label(id)} share (%)`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={value[id] ?? ''}
                aria-invalid={pct === null ? true : undefined}
                onChange={(event) =>
                  onChange({ ...value, [id]: event.target.value })
                }
                className="w-24 text-right tabular-nums"
              />
              <span className="text-sm">{label(id)}</span>
            </li>
          );
        })}
      </ul>
      <p
        className="text-muted-foreground text-sm tabular-nums"
        aria-live="polite"
      >
        {remainder === 0
          ? 'Total 100%'
          : remainder > 0
            ? `${remainder}% left to assign`
            : `Over by ${-remainder}%`}
      </p>
      {(invalid || remainder !== 0) && (
        <p role="alert" className="text-destructive text-sm">
          {invalid
            ? 'Enter a whole number from 0 to 100 for each member'
            : 'Shares must total 100%'}
        </p>
      )}
    </div>
  );
}
