---
id: 023
slug: dashboard-loading-error-ux
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner approved design (loading+error+empty scope; single dashboard error.tsx; empty-states bounded to 4 main tables) in brainstorming
shipped: 2026-06-03
impl_pr: direct-to-main (solo project; spec-first + green gates)
supersedes:
constitution_satisfies:
  - '§4.1' # pages compose from features; data-fetching moves to RSC prefetch, client bodies stay presentational
constitution_overrides:
---

# Spec fix/023: Dashboard loading & error UX consistency

## Problem

Four dashboard pages (`assets`, `salary`, `equity`, `expenses`) are
`'use client'` and fetch via React Query after hydration, gating on
`if (isLoading) return <Loader2 className="animate-spin" />`. Each route also
has a `loading.tsx` skeleton, but that skeleton is the Suspense fallback for the
**server segment render** — which resolves near-instantly for a client page with
no server work. So the skeleton flashes imperceptibly and the user actually
stares at a bare spinner during the real data wait. The `(overview)` page already
fixed this (fix/020: RSC prefetch + `HydrationBoundary`) but the other four never
got the treatment. Separately, only 1 of 7 dashboard routes has an `error.tsx`,
so a failed query on the others throws raw, and empty (zero-data) states are
handled ad-hoc per component.

## Constitution check

- Satisfies: `§4.1` (pages compose from features; data-fetching moves into the
  page's RSC prefetch, the client body stays presentational). Overrides: none.
- **No `HARD` rule touched.** No encryption, auth, schema, or dependency change.
  Server actions still run `requireUserId()` → `getVaultDekSession()` exactly as
  today; `prefetchQuery` calls them server-side just as `(overview)` already does.
- No new dependency (`@tanstack/react-query` `HydrationBoundary`/`dehydrate`
  already used by the overview page).

## Solution shape

### 1. Loading — RSC prefetch (4 pages)

For each of `assets`, `salary`, `equity`, `expenses`, mirror the established
`(overview)` pattern:

- **`src/app/dashboard/<route>/page.tsx`** — convert to an `async` server
  component: `export const dynamic = 'force-dynamic'`; build a `QueryClient`;
  `await Promise.all([...])` prefetching the route's query(s); return
  `<HydrationBoundary state={dehydrate(queryClient)}><X /></HydrationBoundary>`.
  `prefetchQuery` never throws (vault-locked / auth-fail leaves the query
  uncached and the client hook fetches as before — same fail-soft as overview).
- **`src/app/dashboard/<route>/<route>-body.tsx`** (new, `'use client'`) — the
  current page JSX, minus the `if (isLoading) <Loader2/>` block and its
  `Loader2` import. The hook reads the hydrated cache → `isLoading` is `false`
  on first paint → no spinner.
- **`loading.tsx`** skeletons unchanged — now they cover the real prefetch wait.
- Per-route query/action used by the prefetch (same key the hook already uses):
  - assets → `SNAPSHOTS_KEY` / `getSnapshots` (chart data is derived client-side
    from snapshots — no separate fetch).
  - salary → `SALARY_KEY` / `getSalaryRecords`.
  - equity → `TRADES_KEY` / `getTrades`. **`TRADES_KEY` is currently
    module-private in `src/features/equity/hooks/use-equity.ts`** — export it (and
    surface via the hooks barrel) so the page prefetches with the hook's exact
    key. Single source; no duplicated literal.
  - expenses → `EXPENSE_KEY` / `getExpenses` (already exported). `PEOPLE_KEY` is
    a cheap plaintext secondary used by quick-add; prefetch it too so the
    suggestions are warm, but it is not gating the page.

### 2. Error boundaries

- **`src/components/layout/dashboard-error.tsx`** (new, `'use client'`) — extract
  the existing `(overview)/error.tsx` body verbatim as `DashboardError` with the
  canonical Next `{ error: Error & { digest? }, reset: () => void }` contract
  (AlertCircle, message, `error.digest` reference, Try-again → `reset`). Export
  via `components/layout` barrel.
- **`src/app/dashboard/error.tsx`** (new) — `'use client'`, default-exports a
  component that renders `<DashboardError {...props} />`. One boundary now covers
  all six previously-unprotected dashboard routes.
- **Delete `src/app/dashboard/(overview)/error.tsx`** (redundant — the
  dashboard-level boundary catches overview too). Repoint
  `test/app/dashboard-error.test.tsx` to import the shared `DashboardError`
  component.

### 3. Empty states

- **`src/components/widgets/empty-state.tsx`** (new) — `EmptyState({ icon, title,
description?, action? })`, semantic-token styled, centered. Export via
  `components/widgets` barrel.
- Apply to the **primary zero-data surface** of each of the four pages, replacing
  ad-hoc inline "no data" text: the asset snapshot table, salary table, equity
  trade/holdings table, expense table. Bounded to the page-level empty case — not
  every sub-chart or breakdown card.

### Testing

- `test/components/dashboard-error.test.tsx` (renamed/repointed from
  `test/app/dashboard-error.test.tsx`) — `DashboardError` renders message,
  digest reference, omits reference without digest, calls `reset` on click
  (carry the existing three cases onto the shared component).
- `test/components/empty-state.test.tsx` (new, jsdom) — renders title +
  description, renders the action node when provided.
- RSC prefetch wiring is covered by `pnpm build` (server/client boundary
  correctness) + the existing hook tests; skeletons are presentational, untested.

## Out of scope

- Decomposing the oversized components (expense-table 614, investment-breakdown
  570, salary-planner 494, etc.) — a separate effort.
- The `(overview)` page body (already on this pattern) and the dashboard
  `entry` / `profile` pages (forms, not query-gated spinner pages) beyond
  inheriting the new `dashboard/error.tsx` boundary.
- Marketing / landing pages and the vault unlock overlay.
- Any change to encryption, auth, server actions, schema, or query semantics
  (optimistic expense contract from spec 011/fix-017 is untouched).

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck)
- [ ] `pnpm test:ci` green; new/repointed tests cover `DashboardError`
      (message/digest/reset) and `EmptyState` (title/description/action)
- [ ] `pnpm build` green (all four converted pages compile as RSC with a client
      body; no `'use client'` + `async` clash)
- [ ] No `Loader2` / `animate-spin` remains in the four `dashboard/<route>`
      page trees (grep clean)
- [ ] Manual: navigating to assets/salary/equity/expenses shows the route
      skeleton then content — no spinner; a thrown query error shows the shared
      error UI with Try-again; a fresh account with no data shows the EmptyState
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: the four authenticated dashboard list pages + the shared
  error/empty presentation. No data, auth, or crypto path touched. Worst-case
  bug = a page rendering its skeleton longer than ideal, or an empty-state copy
  mismatch — never data loss.
- **Reversibility**: single `git revert` (new `*-body.tsx` / `dashboard-error` /
  `empty-state` files + page edits + the `TRADES_KEY` export). No migration, no
  data change.
- **Backout plan**: revert the commit; pages return to client-fetch + spinner,
  the overview-specific error boundary returns with its revert.

## Open questions

- None. (Scope = loading + error + empty; single `dashboard/error.tsx` replacing
  the overview-specific one; empty-states bounded to the four main tables — all
  confirmed with owner in brainstorming.)
