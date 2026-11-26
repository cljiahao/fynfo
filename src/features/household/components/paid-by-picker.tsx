'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useHousehold } from '../hooks/use-household';
import { useMemberLabels } from '../hooks/use-member-labels';

interface PayerOptions {
  /** The caller, the default payer; undefined until the household loads. */
  selfId: string | undefined;
  /** Goal members when the goal has any, else the household roster. */
  options: string[];
  /** The picker only makes sense with someone else to attribute to. */
  enabled: boolean;
}

export function usePayerOptions(
  goalMemberIds?: readonly string[]
): PayerOptions {
  const { data } = useHousehold();
  const options =
    goalMemberIds && goalMemberIds.length > 0
      ? [...goalMemberIds]
      : [...(data?.memberIds ?? [])];
  return {
    selfId: data?.userId,
    options,
    enabled: options.length > 1,
  };
}

interface PaidByPickerProps {
  /** Selected user id; the caller when null. */
  value: string | null;
  onChange: (userId: string) => void;
  options: string[];
  selfId: string | undefined;
  disabled?: boolean;
}

export function PaidByPicker({
  value,
  onChange,
  options,
  selfId,
  disabled,
}: PaidByPickerProps) {
  const { label } = useMemberLabels();
  if (options.length < 2) return null;
  const selected = value ?? selfId;
  const ordered = [...options].sort(
    (a, b) => Number(b === selfId) - Number(a === selfId)
  );
  return (
    <div className="space-y-1.5">
      <Label id="paid-by-label">Paid by</Label>
      <div
        role="group"
        aria-labelledby="paid-by-label"
        className="flex flex-wrap gap-2"
      >
        {ordered.map((userId) => (
          <Button
            key={userId}
            type="button"
            size="sm"
            variant={selected === userId ? 'default' : 'outline'}
            aria-pressed={selected === userId}
            disabled={disabled}
            onClick={() => onChange(userId)}
          >
            {label(userId)}
          </Button>
        ))}
      </div>
    </div>
  );
}
