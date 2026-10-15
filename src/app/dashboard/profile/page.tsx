'use client';

import { PageHeader } from '@/components/widgets';
import { ExportDataCard, ProfileForm } from '@/features/profile';

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Profile"
        description="Manage your personal details for accurate tax and CPF calculations"
      />

      <ProfileForm />
      <ExportDataCard />
    </div>
  );
}
