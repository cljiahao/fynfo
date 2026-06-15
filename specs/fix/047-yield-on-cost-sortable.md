---
id: 047
slug: yield-on-cost-sortable
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.1' # UI: sortable table headers
constitution_overrides:
---

# Spec 047: Sortable headers on the yield-on-cost table

## Problem

The yield-on-cost table is fixed-sorted by yield descending. The user wants to
sort by any column (ticker / 12-month income / yield), matching the clickable
sort-header pattern already used in `market-allocation-table.tsx`.

## Constitution check

- Satisfies `§4.1`. Overrides: none. No migration, no new dependency. One
  component file.

## Solution shape

`src/features/equity/components/yield-on-cost-table.tsx`:

- Add `sortKey` (`ticker | income | yield`) + `sortDir` state with a `toggleSort`
  (same toggle semantics as market-allocation: clicking the active column flips
  direction; a new column defaults asc for ticker, desc for numeric). Default
  `yield`/`desc` (current behaviour).
- Move row derivation into a `useMemo` that also applies the sort; render clickable
  headers with the asc/desc/neutral arrow icons (`ArrowUp`/`ArrowDown`/`ArrowUpDown`).
- Hooks run before the empty-state early return (rules-of-hooks).

## Out of scope

- Text filtering / search (this is sort only). The metric definition is unchanged.

## Acceptance

- [ ] `pnpm check` / `pnpm test:ci` / `pnpm build` green
- [ ] Manual: clicking each header sorts asc/desc; default is yield desc
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: one presentational component.
- **Reversibility**: single `git revert`.

## Open questions

- [ ] Q: none.
