---
id: 024
slug: loading-client-skeleton
area: fix
status: approved # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner confirmed diagnosis + Option A (client pages + shared skeleton) after verification
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§4.1' # pages compose from features; presentational skeleton shared by loading.tsx + the page
constitution_overrides:
---

# Spec fix/024: Loading via client cache + shared skeleton

## Problem

fix/023 converted the four list pages (`assets`, `salary`, `equity`,
`expenses`) to `force-dynamic` async RSC that `await prefetchQuery` into a
`HydrationBoundary`. Verified regression: these pages read the vault cookie, so
they are **dynamic** — Next 16's Router Cache `staleTime` for dynamic routes is
**0**, meaning every navigation re-renders on the server and blocks on the
prefetch (a second `getUser()` + the data query + AES decrypt + RSC-payload
serialize). The shared `QueryClient` lives in the root layout (`staleTime` 5min,
persists across navigations), so the **previous** client pages rendered warm
data **instantly with zero network**. fix/023 replaced that instant warm-nav
with a skeleton + server round-trip on every visit. The four pages are
single-query, so they never had the multi-query waterfall that justifies RSC
prefetch — only the `(overview)` page does.

## Constitution check

- Satisfies: `§4.1` (pages compose from features; the skeleton is presentational
  and shared). Overrides: none.
- **No `HARD` rule touched.** No encryption, auth, schema, or dependency change.
- No new dependency.

## Solution shape

For each of `assets`, `salary`, `equity`, `expenses`:

- **`src/app/dashboard/<route>/page.tsx`** — revert to a `'use client'` component
  (the body re-inlined from fix/023's `*-body.tsx`). Replace the deleted
  `Loader2` spinner with the route skeleton: `if (isLoading) return <XSkeleton/>`.
  No `force-dynamic`, no `QueryClient`/`prefetchQuery`/`HydrationBoundary`. Warm
  navigations now render from the persistent client cache instantly; a genuine
  cold load shows the skeleton while the hook fetches.
- **`src/app/dashboard/<route>/<route>-skeleton.tsx`** (new) — the skeleton
  markup extracted verbatim from the route's current `loading.tsx`, exported as
  `XSkeleton`. Presentational only.
- **`src/app/dashboard/<route>/loading.tsx`** — render `<XSkeleton/>` (single
  source; loading.tsx still covers the brief RSC nav suspense, the `isLoading`
  branch covers the client fetch — identical pixels).
- **Delete** `src/app/dashboard/<route>/<route>-body.tsx` (the fix/023 split).
- **Re-privatize the keys** exported only for fix/023's prefetch:
  `TRADES_KEY` (`features/equity/hooks/use-equity.ts`) and `PEOPLE_KEY`
  (`features/expenses/hooks/use-expenses.ts`) — drop the `export` and remove
  them from the hooks barrels (no remaining consumer; keep the API surface tight).

Untouched: `(overview)` keeps its RSC prefetch (real 4-query post-PIN
waterfall); the error boundaries and `EmptyState` from fix/023 stay.

## Out of scope

- The `(overview)` page (RSC prefetch is correct there).
- Error boundaries / `EmptyState` (fix/023, keep).
- The `entry` / `profile` form pages.
- Decomposing oversized components.
- Any encryption/auth/schema/query-semantics change.

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck)
- [ ] `pnpm test:ci` green (no test change expected; skeleton + pages are
      presentational)
- [ ] `pnpm build` green (the four pages compile as client components; no
      `force-dynamic`/`HydrationBoundary` remains in them)
- [ ] No `*-body.tsx` remains under `src/app/dashboard/`; no `HydrationBoundary`
      import in the four pages; no `animate-spin`/`Loader2` in the four page trees
- [ ] `TRADES_KEY` / `PEOPLE_KEY` no longer exported (grep)
- [ ] Manual: cold-load a page → skeleton then content; navigate away and back
      within 5min → **instant**, no skeleton flash, no spinner

## Risk & reversibility

- **Blast radius**: the four authenticated list pages' loading path only. No
  data, auth, or crypto path touched.
- **Reversibility**: single `git revert` (restores fix/023's RSC pages). No
  migration, no data change.
- **Backout plan**: revert the commit.

## Open questions

- None. (Diagnosis verified against Next 16 dynamic Router Cache + root-layout
  QueryClient; Option A confirmed with owner.)
