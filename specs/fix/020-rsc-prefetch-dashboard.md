---
id: 020
slug: rsc-prefetch-dashboard
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Track A spike fix #2; Clarence pre-approved roadmap
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.1' # data fetched server-side; page composes from features
constitution_overrides:
---

# Spec 020 (fix): RSC-prefetch the dashboard (kill the post-PIN fetch waterfall)

## Problem

Track A spike fix #2. The overview page is `'use client'`, so its four data queries
(`useSnapshots`, `useSalaryRecords`, `usePlannerSettings`, `useExpenses`) only fire **after** the route
JS bundle downloads and hydrates — a hydrate-before-fetch waterfall, and the biggest remaining slice of
"dashboard slow after PIN". Decryption is not the cost (spike: ~12 ms); the waterfall + round-trips
are.

## Constitution check

- Satisfies `§4.1` (server-side data fetch; page composes from features). Overrides: none. No
  migration, no new dependency (TanStack Query already provides `dehydrate`/`HydrationBoundary`), no
  encryption-path change. No security-sensitive auth code touched (no `action-guard` change).

## Solution shape

- Split the route into a server shell + client body:
  - `page.tsx` becomes an async **Server Component**: build a `QueryClient`, `prefetchQuery` the four
    datasets **in parallel** (`SNAPSHOTS_KEY`/`SALARY_KEY`/`PLANNER_KEY`/`EXPENSE_KEY` + the
    corresponding server actions), then render `<HydrationBoundary state={dehydrate(qc)}>` around the
    body. `export const dynamic = 'force-dynamic'` (per-user, vault-cookie-dependent — never cached).
  - New `dashboard-overview.tsx` (`'use client'`) holds the former page body verbatim (the four hooks
    now read from the hydrated cache; `useState`/`useCallback` interactivity unchanged).
- Export the four query-key constants from their hooks so the prefetch keys are the single source of
  truth (no drift between prefetch and `useQuery`).
- **Fail-safe:** `prefetchQuery` never throws and only successful queries are dehydrated, so a locked
  vault / auth failure during SSR simply leaves the cache empty and the client hook fetches exactly as
  today.

## Out of scope

- Deduping the four server-side `getUser()` calls into one (React `cache()`): deferred — it couples
  `action-guard` to render context and risks test-memo bleed; the waterfall removal is the win.
- Fix #3 (`getClaims()` local verify) and audit HIGH #2 (work-factor) — security-posture changes,
  separate governance decision.
- Embedding decrypted data in the RSC payload is **not** a new exposure: the server already decrypts
  in-request using the DEK cookie and returns plaintext to the same authenticated client over TLS; the
  route is `force-dynamic` (uncached).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green (RSC + client split type-checks; no
      `'use client'`/server-import violations).
- [ ] `page.tsx` is a server component that prefetches all four keys and wraps the body in
      `HydrationBoundary`; `dashboard-overview.tsx` is the client body.
- [ ] Prefetch keys are imported from the hooks (single source).
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.
- [ ] Manual: dashboard renders with data on first paint after unlock; locked-vault path still works
      (falls back to client fetch).

## Risk & reversibility

- **Blast radius**: the overview route's data-loading path. Interactivity and mutation cache behavior
  unchanged (same hooks, same keys). Worst case the prefetch no-ops and behavior is identical to today.
- **Reversibility**: single `git revert` (restores the all-client page).
- **Backout plan**: revert the commit.

## Open questions

- None.
