'use client';

import { SnapshotForm } from '@/features/assets';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function EntryContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit') ?? undefined;

  return (
    <div className="max-w-content mx-auto w-full px-6 py-8">
      <SnapshotForm editId={editId} />
    </div>
  );
}

export default function EntryPage() {
  return (
    <Suspense>
      <EntryContent />
    </Suspense>
  );
}
