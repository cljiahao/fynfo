---
id: '185'
slug: household-pace-reconcile
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-10
approved: 2026-11-10 # owner-authorized in chat 2026-11-10 ("fix all please"), follow-up to spec 183
shipped: 2026-11-10 # YYYY-MM-DD, set on impl merge
impl_pr: none (direct to main); commit 767f532 # no PR (direct to main)
supersedes: '183 (partial: "savings-surplus offset never on the household page", for one sentence only)'
constitution_satisfies:
  - '§2.1'
  - '§2.6'
  - '§3.2'
  - '§5.1a'
---

# Spec 185: Reconcile household per-goal monthly with the plan

## Problem

After spec 183 the overview says "Together $4,783 a month" while the goal cards
show "$4,615.38/mo needed" and "$2,173.91/mo needed" (sum $6,789). The cards and
the goal detail "Monthly pace" stat still use the old standalone per-goal pace,
while the overview uses `computeHouseholdPlan` (latest-first placement, binding
cumulative deadline). Separately, a user whose personal savings already cover
their share sees a household figure with no hint of that.

## Constitution check

- Satisfies: `§2.1`, `§2.6` (feature barrels only; one additive barrel export
  set on `@/features/assets`), `§3.2`, `§5.1a` (no personal data leaves the
  browser; the surplus is computed client-side from the caller's own queries).
- Overrides: none. Touches no HARD rule.
- Authorization: owner, in chat on 2026-11-10 ("fix all please"), as a follow-up
  to spec 183. It amends 183's decision that the savings-surplus offset never
  applies on the household page, for the single covered sentence below only.

## Solution shape

- `lib/household-joint-plan.ts` (new): `sharedInput`, moved from the summary;
  `jointGoalMonthly` returns each goal's slice of the joint `goalsMonthly`,
  weighted by that goal's `scheduleTotal` from `computeHouseholdPlan` at share 1
  and surplus 0, so slices sum to the overview's goals figure. The plan's own
  `perGoal[].monthly` is a standalone figure per goal and overlaps between goals,
  so it cannot be used directly. `savingsCoverShare` is true when the caller's
  share has a non-zero goals schedule that a given surplus reduces to zero.
  `household-plan.ts` is unchanged.
- `hooks/use-joint-goal-monthly.ts` (new): the slices from the shared plan query,
  null while loading, failed or not ready.
- `goal-list.tsx` and `goal-card.tsx`: card shows `$X/mo needed` from the slice,
  nothing until known, `Nothing to set aside monthly` when the slice is 0 for a
  dated goal with money remaining. "Past target date" and undated goals are
  unchanged.
- `goal-detail.tsx`: the stat is relabelled "Monthly needed" and uses the slice.
- `household-overview.tsx`, `household-plan-summary.tsx`: optional
  `personalSurplus` prop; under "Your share" the sentence
  `Your savings already cover your share.` shows only when
  `savingsCoverShare` is true. "Together", cards, "Behind" and recommendations
  stay joint and surplus-free.
- `src/app/dashboard/household/household-surplus-overview.tsx` (new, client)
  derives `S = max(0, savings + bonds - emergency - warChest)` with the shared
  `derivePersonalSurplus` (latest snapshot, planner settings, expenses average
  or per-browser override) and passes it down; null until all inputs have
  loaded. `household-with-savings.tsx` loads it with `next/dynamic` so the
  assets barrel (and the planner) stay out of the page's first load.
  Composing at the page keeps `household` from importing `assets`, which already
  imports `household`.
- `assets/index.ts`: additive exports `calcRecentAvgExpense`, `computeSalaryPlan`,
  `sumByCategory`, `useExpensesOverride`. No planner behaviour changes.

## Out of scope

- "Behind" semantics (recorded joint contributions) and the recommendation list.
- The burn-up chart's straight-line dashed pace.
- Any change to plan maths, migrations, server actions or dependencies.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] Slices sum to the joint goals figure for the two-goal example (Wedding
      $60,000 by 2027-11-27, Renovation $50,000 by 2028-10-01)
- [ ] Sentence shows only when surplus covers the caller's scheduled share, never
      alters other figures, hidden while loading or unknown

## Known limitations

- The per-goal figure is a share of the joint monthly plan, not a per-goal deadline pace. Goals are placed latest-first against a binding cumulative deadline, so a goal's slice can be smaller or larger than what it alone would need by its own date.
- Behind badges and recommendations use each goal's real deadline, so they can disagree with the share shown on the card.
- A goal with dated items but no target date shows a share only when the plan schedules entries for it; a goal with no schedule at all shows nothing.

## Risk & reversibility

- **Blast radius**: household page text only; client-side.
- **Reversibility**: single git revert.
- **Backout plan**: revert the implementing commit.

## Open questions

- [x] Q: Slice by schedule weight or earliest-deadline-first? — Owner: Claude
      Code — A: schedule weight; simple, sums exactly, no near-zero second card.
