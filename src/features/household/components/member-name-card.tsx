'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useHousehold } from '../hooks/use-household';
import { MemberNameField } from './member-name-field';

/** Profile-page card for the caller's household display name. */
export function MemberNameCard() {
  const household = useHousehold();
  const data = household.data;

  // The name is sealed under K_h, so a locked household cannot save it; the
  // household page already owns the unlock prompt.
  if (!data || data.locked) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household name</CardTitle>
        <CardDescription>How other household members see you.</CardDescription>
      </CardHeader>
      <CardContent>
        <MemberNameField current={data.memberNames?.[data.userId] ?? ''} />
      </CardContent>
    </Card>
  );
}
