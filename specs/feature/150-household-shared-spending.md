---
id: '150'
slug: household-shared-spending
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

# Spec 150: Combined household spending and trips

## Problem

Household goals cover saving toward big purchases. Shared day-to-day costs
(groceries, utilities, rent) and trips (a vacation's flights, hotel, food) have
nowhere to live in the household. Each partner logs their own share in their
personal expenses, so neither can see the combined total, the split by
category, or who has paid more this month.

Owner direction (2026-10-23): allow combining things like household expenses
and vacations. Approved under the owner's standing go-ahead for non-security
work. The production migration stays owner-run (§7.4); this PR is not merged
until the owner confirms the SQL has been applied.

## Constitution check

- Satisfies: `§1.1` (household-scoped data only), `§2.1` (category, amount and
  note encrypted under `K_h`), `§2.3` (`requireHouseholdContext()` on every
  action), `§5.1a` (existing `K_h` only), `§5.4` (only `date` and `kind` are
  plaintext coarse metadata).
- Overrides: none. No new crypto protocol.

## Solution shape

- **Migration** `supabase/migrations/20261023000150_household_shared_spending.sql`
  (idempotent, additive):
  - `household_spaces`: `id`, `household_id` cascade, `kind` plaintext
    (`'ongoing' | 'trip'`), `name` (enc), `start_date` / `end_date`
    (plaintext, optional, trips only), `created_by`, `created_at`.
  - `household_spending`: `id`, `space_id` → `household_spaces` cascade,
    `payer_user_id` → `auth.users`, `date` plaintext, `category` (enc),
    `amount` (enc), `note` (enc, optional), `created_at`.
  - RLS mirrors spec 054: members read, update and delete; insert requires
    membership and `created_by` / `payer_user_id = auth.uid()`.
- **Actions** `features/household/actions/spending-actions.ts`:
  `getSpaces()` (with spending rows), `createSpace`, `deleteSpace`,
  `addSpending`, `deleteSpending`. Zod schemas in `schemas.ts`.
- **Pure math** `features/household/lib/shared-spending.ts`: totals per space,
  per month, per category and per payer, and an even-split settle-up ("Partner
  owes you $X"). Unit tested.
- **UI**: the household page gains tabs: **Goals** (existing, with spec 149
  breakdown) and **Spending**. Spending shows:
  - A combined summary for the selected month across all ongoing spaces:
    total, by category, you vs partner paid, settle-up.
  - Space cards: "Household" (ongoing) and each trip with its date range,
    total and by-category split.
  - A quick-add row like the expenses page (date, category, amount, note,
    space), keyboard-first, defaulting to the last-used space and category.

## Out of scope

- Uneven split ratios (even split only for now).
- Importing or linking personal expenses.
- Multi-currency trips (amounts are SGD, like personal expenses).

## Acceptance

- [ ] Migration applies cleanly on the local stack after spec 149's, and
      re-runs idempotently.
- [ ] RLS SQL test: non-members cannot read or write spaces or spending.
- [ ] Unit tests for `shared-spending.ts` including settle-up rounding;
      action tests; component tests for quick-add and the summary.
- [ ] `pnpm check && pnpm test:ci && pnpm build` green.
- [ ] Manual on the local stack: an ongoing space and a trip, entries by the
      test user; totals, category split and settle-up correct.
- [ ] Owner applies the migration in production before merge.

## Risk & reversibility

- **Blast radius**: household page only.
- **Reversibility**: code revert is safe; tables are additive.
- **Backout plan**: revert the implementation commit; leave tables unused.

## Open questions

None blocking. Even split assumed; ratios can follow if wanted.
