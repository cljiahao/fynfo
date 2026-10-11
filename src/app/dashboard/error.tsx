'use client';

import { DashboardError } from '@/components/layout';

export default function DashboardRouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <DashboardError error={error} reset={retry} />;
}
