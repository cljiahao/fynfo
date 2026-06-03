---
id: 025
slug: loading-spinner-consistency
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner: "do all" — finish skeleton-not-spinner consistency
shipped: 2026-06-03
impl_pr: direct-to-main (solo project; spec-first + green gates)
supersedes:
constitution_satisfies:
  - '§4.1' # presentational loading states only
constitution_overrides:
---

# Spec fix/025: Finish skeleton-not-spinner consistency

## Problem

fix/024 set skeletons as the dashboard loading idiom, but three feature
components still render full-block `Loader2` spinners for their primary data
load: `salary-table` (`size-8`), `profile-form` (`size-8`), and `salary-planner`
(`size-6`). They are inconsistent with the new skeleton direction. The
`salary-table` one is also effectively dead — the salary page already gates on
`isLoading` and renders `<SalarySkeleton/>`, so the table only mounts once its
(shared-cache) records are present.

Legit spinners are explicitly **kept**: form-submit pending states (`isPending`
on buttons) and the tiny inline live-stock-price loaders (`pricesLoading`,
`size-3`) — those are correct.

## Constitution check

- Satisfies: `§4.1` (presentational only). Overrides: none. No `HARD` rule, no
  encryption/auth/schema/dependency change.

## Solution shape

- **`src/features/salary/components/salary-table.tsx`** — remove the dead
  `if (isLoading) <Loader2/>` block; drop `isLoading` from the `useSalaryRecords`
  destructure and `Loader2` from the import (records are present when the table
  mounts; an empty array already falls through to the `EmptyState`).
- **`src/features/profile/components/profile-form.tsx`** — replace the
  full-height `Loader2` load state with a small inline `Skeleton` form
  placeholder (keep `Loader2` — still used by the submit button's `isPending`).
- **`src/features/assets/components/salary-planner.tsx`** — replace the
  `Loader2` card body with a `Skeleton` card placeholder; drop the now-unused
  `Loader2` import.

## Out of scope

- Form-submit spinners and inline price-loading spinners (correct as-is).
- The four route pages (fix/024, already skeleton-gated).
- Component decomposition (separate refactor specs).

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green (presentational; no test change expected)
- [ ] `pnpm build` green
- [ ] No primary-data `Loader2` block remains in the three components; the only
      `animate-spin` left in features is on submit buttons (`isPending`) or the
      `size-3` price loaders (grep)
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: three components' loading presentation only. No data/auth.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
