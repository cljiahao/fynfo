---
id: 164
slug: lazy-page-views
area: audit
status: draft # owner-authorized remediation record (CONSTITUTION §7.4)
author: Claude (builder)
created: 2026-11-02
approved:
shipped:
impl_pr:
constitution_satisfies: ['§2.1', '§2.6', '§7.4']
constitution_overrides: []
---

# Audit 164: Mount page tabs lazily

Owner Clarence asked on 2026-11-02 to fix degraded dashboard performance. This record is owner-authorized remediation under AGENTS.md §1.5.

## Evidence

`PageViews` rendered every tab's content on first load and only toggled `hidden`. Hidden tabs therefore ran their React Query reads and rendered charts at 0x0 (recharts `width(-1)` warnings). The reads are server actions, which Next.js runs one at a time per client, and each performs `supabase.auth.getUser()` plus a DEK cookie unseal, so hidden-tab reads queued ahead of the visible tab's data.

Reads that no longer fire on initial load of the default tab:

- Overview (`src/app/dashboard/(overview)/dashboard-overview.tsx`, tabs at lines 96-170):
  - `usePlannerSettings` via `SalaryPlanner` (`src/features/assets/components/salary-planner.tsx:67`), Plan tab.
  - `useStockPrices` via `InvestmentBreakdown` (`investment-breakdown.tsx:65`) and `InvestmentAllocation` (`investment-allocation.tsx:38`), Plan tab. Both share one query key.
  - `useSnapshots`, `useSalaryRecords`, `useExpenses`, `useTrades`, `useExchangeRate` in the Plan and Review tabs (`salary-planner.tsx:61,73`, `monthly-review.tsx:32-34`, `investment-breakdown.tsx:59,66`) are already issued by the visible tab or the page, so they were de-duplicated by key and are unchanged.
  - Net: 2 distinct server-action reads (planner settings, stock prices) plus the Plan-tab and Review-tab render work.
- Equity (`src/app/dashboard/equity/page.tsx`): only `useDividends` via `DistributionsSection` (`distributions-section.tsx:42`), Dividends tab, is deferred (1 read). `useExchangeRate` in that tab (`distributions-section.tsx:44`) shares its key with the default Holdings tab (`holdings-table.tsx:185`), so it is de-duplicated. Holdings tab keeps `useStockPrices` (`portfolio-summary.tsx:29`, `holdings-table.tsx:184`).
- Expenses (`src/app/dashboard/expenses/page.tsx`): `useRecurringRulebook` and `useRecurringExpenseLinks` via `RecurringReview` (`recurring-review.tsx:81-82`), Recurring tab.
- Assets and salary: hidden tabs reuse page-level queries; the saving is chart and table render work.

## Change

- `src/components/widgets/page-views.tsx`: a panel mounts when its tab is first selected, including a controlled `value` change, and then stays mounted (hidden) so unsaved form input survives tab switches. The `<section>` shell with `hidden` is always rendered so `aria-controls` never dangles.
- `src/features/equity/hooks/use-prices.ts`: TanStack Query v5 (`query-core` 5.97.0, `queryObserver.ts:406`) only polls while the window is focused unless `refetchIntervalInBackground` is set, so stock-price polling already pauses in a background tab; a comment records this. `useExchangeRate` loses its `refetchInterval` since a display rate with a 5-minute `staleTime` needs no polling.
- Tests: `test/components/widgets/page-views.test.tsx` (new), `test/features/equity/use-prices.test.tsx`.

## Acceptance checks

- Unvisited tab content does not mount; a visited tab keeps form state; controlled value changes mount the panel.
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` pass.

## Rollback

Revert the commit. No data, schema or dependency change.
