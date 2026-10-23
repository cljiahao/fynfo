---
id: '149'
slug: household-project-breakdown
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-10-23
approved: 2026-10-23
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.3'
  - '§5.1a'
  - '§5.4'
constitution_overrides:
---

# Spec 149: Budget breakdown for household projects

## Problem

Household goals (spec 054) track one target and the savings put toward it. A
big project such as a wedding or a renovation is really a set of budget lines
(venue, photographer, carpentry, appliances), each with a planned cost and
payments made against it. Today the owner cannot see which parts are over or
under budget, or how much has actually been paid out versus saved.

Owner direction (2026-10-23): expand household with a breakdown of each big
project. Approved under the owner's standing go-ahead for non-security work.
The production migration stays owner-run (§7.4); this PR is not merged until
the owner confirms the SQL has been applied.

## Constitution check

- Satisfies: `§1.1` (household-scoped data only), `§2.1` (names, amounts and
  notes encrypted under `K_h`; server never sees plaintext), `§2.3` (actions use
  `requireHouseholdContext()`), `§5.1a` (no new key, no new PIN, existing
  `K_h` only), `§5.4` (dates stay plaintext coarse metadata; nothing sorts or
  filters on ciphertext).
- Overrides: none. No new crypto protocol: the same `encryptPayload` under
  `K_h` as spec 054.

## Solution shape

- **Migration** `supabase/migrations/20261023000149_household_project_items.sql`
  (idempotent, additive):
  - `household_goal_items`: `id`, `goal_id` → `household_goals` cascade,
    `name` (enc), `budget` (enc), `created_at`.
  - `household_goal_payments`: `id`, `item_id` → `household_goal_items`
    cascade, `payer_user_id` → `auth.users`, `amount` (enc), `note` (enc,
    optional), `date` (plaintext), `created_at`.
  - RLS mirrors spec 054: membership through the parent goal's household;
    payment insert requires `payer_user_id = auth.uid()`.
- **Actions** (`features/household/actions/goal-actions.ts`): `getGoals()`
  also returns each goal's items with `budget`, `paid`, `remaining` and
  payments (`isSelf` like contributions). New `addGoalItem`, `deleteGoalItem`,
  `addItemPayment`, `deleteItemPayment`, each Zod-validated with
  `parseOrThrow`.
- **Pure math** `features/household/lib/project-budget.ts`: per-item and
  per-goal totals (budgeted, paid, over-budget amount), unit tested.
- **UI** (`goal-card.tsx` + a new `project-breakdown.tsx`): a collapsible
  "Breakdown" section per goal listing items with a paid/budget bar, an
  over-budget marker, and inline "Add item" and "Record payment" controls.
  The goal card header shows total budgeted versus the goal target, and total
  paid. Goals with no items look the same as today.

## Out of scope

- Shared day-to-day spending and trips (spec 150).
- Linking personal expenses to project items.
- Editing items in place (delete and re-add for now).

## Acceptance

- [ ] Migration applies cleanly on the local stack (spec 147) after all
      existing migrations, and re-runs idempotently.
- [ ] RLS: a non-member cannot read or write items or payments (SQL test in
      `supabase/tests`, matching the existing pattern).
- [ ] Unit tests for `project-budget.ts`; action tests for validation,
      encryption and the household guard; component tests for the breakdown.
- [ ] `pnpm check && pnpm test:ci && pnpm build` green.
- [ ] Manual on the local stack: create a household, a "Wedding" goal, two
      items, payments over and under budget; totals and markers correct.
- [ ] Owner applies the migration in production before merge.

## Risk & reversibility

- **Blast radius**: household goals page only. Existing goals and
  contributions untouched.
- **Reversibility**: code revert is safe; the tables are additive. Dropping
  them loses item data, so a rollback leaves the tables in place.
- **Backout plan**: revert the implementation commit; leave tables unused.

## Open questions

None blocking. Production SQL is owner-run.
