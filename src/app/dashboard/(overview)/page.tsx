import { OverviewPrefetch } from '@/features/overview';
import { DashboardOverview } from './dashboard-overview';

// Per-user, vault-cookie-dependent data must remain request scoped.
export const dynamic = 'force-dynamic';

export default function DashboardOverviewPage() {
  return (
    <OverviewPrefetch>
      <DashboardOverview />
    </OverviewPrefetch>
  );
}
