---
id: '192'
slug: household-behind-basis
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-17
approved: 2026-11-17 # owner-approved in chat 2026-11-17 ("Approve, build it")
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes: # none; builds on the paid basis defined in spec 190
constitution_satisfies:
  - '§2.1'
  - '§2.4'
  - '§2.5'
  - '§3.1'
  - '§4.1'
constitution_overrides: []
---

# Spec 192: Household overview behind line follows the goal's basis

## Problem

The household overview recommendation reads, for example, "Wedding is $7,9xx
behind; $X more a month catches up", while the goal card and the goal detail
chip for the same goal read "On track". `householdRecommendations`
(`src/features/household/lib/household-plan.ts`) emits the `behind`
recommendation whenever `savedStatus(goal, now) === 'behind'`, which compares
contributions to a straight line to the target date. The chip uses `goalStatus`
(`goal-stats.ts`), which switches to the paid basis defined in spec 190 when
`goalBasis(goal) === 'paid'` (no contributions and costed items).

The owner approved this behaviour in chat on 2026-11-17 ("Approve, build it").

## Constitution check

- Satisfies: `§2.1` (pure client-side derivation, nothing new leaves the
  browser), `§2.4` (logic stays in the feature `lib/`), `§2.5` (no new
  dependency), `§3.1` (regression tests), `§4.1` (no schema, RLS or crypto
  change).
- Overrides: none.

## Solution shape

- `householdRecommendations` calls `goalBasis` (from `goal-stats.ts`) rather
  than re-deriving the rule. `PlanItem` carries `effective` (quote ?? budget), so
  it is passed as `{ budget: effective, quote: null }`, which gives the same
  `plannedTotal`.
- Paid-basis goals never emit the saved-basis `behind` recommendation. They fall
  through to the existing `monthly-pace` recommendation when `figures.monthly > 0`.
- No new recommendation kind. An overdue unpaid item already surfaces through
  the `next-payment` recommendation ("<item> is overdue; your share $X").
- Saved-basis goals (any contribution above 0, or no costed items) are
  unchanged.
- `household-recommendation-copy.ts` wording is untouched.

## Out of scope

- New recommendation kinds or copy.
- Changing `goalStatus`, `goalBasis`, the goal card or the detail chip.
- Schema, migration, RLS, crypto, dependency changes.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] A paid-basis goal that `savedStatus` calls behind yields no `behind` and
      yields `monthly-pace`
- [ ] An overdue unpaid item on a paid-basis goal yields `next-payment`
- [ ] A saved-basis behind goal still yields `behind`
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: the overview recommendation list for items-first goals.
- **Reversibility**: a single git revert.
- **Backout plan**: revert the impl PR.

## Open questions

None. Approved as drafted by the owner in chat on 2026-11-17.
