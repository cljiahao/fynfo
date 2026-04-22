'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useProfile, useUpsertProfile } from '../hooks/use-profile';
import { profileSchema, type ProfileFormValues } from '../schemas';
import type { ProfileData } from '../types';

const DEFAULT_PROFILE: ProfileData = {
  birthYear: null,
  isNsman: false,
  residencyStatus: 'resident',
};

function ProfileFormInner({ initial }: { initial: ProfileData }) {
  const upsertProfile = useUpsertProfile();

  const { control, handleSubmit } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await upsertProfile.mutateAsync(values);
      toast.success('Profile saved');
    } catch {
      toast.error('Failed to save profile');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Personal details used for tax and CPF calculations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="birthYear">Birth Year</Label>
              <Controller
                name="birthYear"
                control={control}
                render={({ field }) => (
                  <Input
                    id="birthYear"
                    type="number"
                    min={1940}
                    max={new Date().getFullYear()}
                    placeholder="e.g. 1990"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                )}
              />
              <p className="text-muted-foreground text-xs">
                Used to determine earned income relief tier and CPF contribution
                rates
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="residency">Tax Residency</Label>
              <Controller
                name="residencyStatus"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="residency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resident">
                        Tax Resident (SC / PR / Foreigner ≥183 days)
                      </SelectItem>
                      <SelectItem value="non_resident">
                        Non-Resident (Foreigner &lt;183 days)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-muted-foreground text-xs">
                Based on days in Singapore, not pass type. Any foreigner staying
                ≥183 days qualifies as a tax resident and is eligible for
                personal reliefs.
              </p>
            </div>
          </div>

          <Controller
            name="isNsman"
            control={control}
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="nsman"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="nsman" className="cursor-pointer">
                    NSman relief (SGD 1,500)
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Male SC/PR who completed compulsory NS only
                  </p>
                </div>
              </div>
            )}
          />

          <Button type="submit" disabled={upsertProfile.isPending}>
            {upsertProfile.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProfileForm() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  return <ProfileFormInner initial={profile ?? DEFAULT_PROFILE} />;
}
