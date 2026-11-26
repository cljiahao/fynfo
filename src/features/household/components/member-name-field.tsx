'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSetMemberName } from '../hooks/use-household';
import { MEMBER_NAME_MAX } from '../schemas';

/** Lets a member change how the rest of the household sees them. */
export function MemberNameField({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);
  const save = useSetMemberName();

  // A refetch (e.g. the seeded default arriving) replaces the field only
  // while the member has not started typing.
  if (current !== synced) {
    setSynced(current);
    if (value === synced) setValue(current);
  }

  const trimmed = value.trim();
  const unchanged = trimmed === current;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || unchanged) return;
        save.mutate(trimmed, {
          onSuccess: () => toast.success('Name saved'),
          onError: () => toast.error('Could not save your name'),
        });
      }}
    >
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Your name in this household</span>
        <Input
          value={value}
          maxLength={MEMBER_NAME_MAX}
          className="w-64"
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <Button
        type="submit"
        variant="outline"
        disabled={!trimmed || unchanged || save.isPending}
      >
        Save name
      </Button>
    </form>
  );
}
