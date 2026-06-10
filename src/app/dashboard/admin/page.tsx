import {
  getMarketingStats,
  MarketingTrendChart,
  StatCards,
} from '@/features/admin';

// Per-request admin telemetry; never statically cached.
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // getMarketingStats gates on requireUserId() + ADMIN_USER_IDS and 404s for
  // non-admins (CONSTITUTION §2.3 admin-read carve-out — no vault required).
  const stats = await getMarketingStats();

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1">
          Storefront telemetry and signups
        </p>
      </div>

      <StatCards totals={stats.totals} />
      <MarketingTrendChart daily={stats.daily} />
    </div>
  );
}
