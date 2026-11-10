---
id: '187'
slug: household-ui-audit-fixes
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-11
approved: 2026-11-11 # owner-authorized in chat 2026-11-11 ("fix all of it and ensure it will work as intended"), follow-up to specs 183 and 185
shipped: 2026-11-11 # YYYY-MM-DD, set on impl merge
impl_pr: none (direct to main); commit f48b360 # no PR (direct to main)
constitution_satisfies:
  - '§2.1'
  - '§2.6'
  - '§5.1a'
---

# Spec 187: Household UI audit fixes

## Problem

A static audit of the UI shipped by specs 183 and 185 found: goal names still
show with "Hide amounts" on (recommendation sentences, the planner household
list, the year table); the household page remounts `HouseholdOverview` when the
lazy surplus chunk arrives, resetting the tab and any open editor; and at 375px
the planner legend label "Set aside this month" is truncated, with a short,
affordance-free toggle. Several tap targets are under 40px.

## Constitution check

- Satisfies: `§2.1`, `§2.6` (feature barrels only), `§5.1a` (no data leaves the
  browser; masking is display only).
- Overrides: none. No HARD rule is touched; plan maths, migrations and
  dependencies are unchanged.
- Authorization: owner, in chat on 2026-11-11, as a follow-up to specs 183/185.

## Solution shape

- Masking: `CopyOptions` gains `maskName`; the recommendation list passes the
  privacy `mask`. The planner household goal link and the year-table goal names
  are wrapped in `mask`, as `goal-card` and `goal-detail` already do.
- Stable tree: `household-with-savings.tsx` mounts `HouseholdOverview` once and
  holds `personalSurplus` in state. A lazily loaded, render-less
  `household-surplus-reporter.tsx` (replaces `household-surplus-overview.tsx`)
  computes the surplus and reports it up, so the assets barrel stays out of the
  first load without changing the overview's identity.
- `planner-flow.tsx`: legend label wraps instead of truncating; the expandable
  toggle is `min-h-10` with a chevron that rotates with `aria-expanded`.
- `goal-editor-sheet.tsx`: `min-h-10` on "Got a final quote?" and "Add payment
  dates"; the per-item due date gets a visible "Due" label and spans both
  columns when the quote column is hidden; the review wrapper gets
  `role="group"` so its `aria-label` is valid.
- Planner household list and year table: amounts `shrink-0 whitespace-nowrap`,
  names `min-w-0`; year buttons gain `aria-controls`. The "You pay %" toggle is
  `min-h-10`.

## Out of scope

Plan maths, copy not listed above, and any live-device verification.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] Names masked in recommendations, planner household list and year table
- [ ] `HouseholdOverview` state survives the surplus arriving
- [ ] Legend toggle shows a chevron tied to `aria-expanded`

## Known limitations

- Layout fixes are verified by class assertions and review, not at a real 375px viewport.
