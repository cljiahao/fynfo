'use client';

import { DashboardError } from '@/components/layout';

// Single error boundary for the whole dashboard subtree (assets, salary,
// equity, expenses, entry, profile, overview). Next requires a default export.
export default function DashboardRouteError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardError {...props} />;
}
