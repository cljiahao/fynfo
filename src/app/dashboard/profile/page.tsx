'use client';

import { PageHeader } from '@/components/widgets';
import { ExportDataCard, ProfileForm } from '@/features/profile';

export default function ProfilePage() {
  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <PageHeader
        title="Profile"
        description="Manage your personal details for accurate tax and CPF calculations"
      />

      <ProfileForm />
      <ExportDataCard />
    </div>
  );
}
