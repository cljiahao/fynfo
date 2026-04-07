'use client';

import { ProfileForm } from '@/features/profile';

export default function ProfilePage() {
  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal details for accurate tax and CPF calculations
        </p>
      </div>

      <ProfileForm />
    </div>
  );
}
