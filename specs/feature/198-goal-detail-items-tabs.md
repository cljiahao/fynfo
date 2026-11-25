---
id: '198'
slug: goal-detail-items-tabs
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-25
approved: 2026-11-25 # YYYY-MM-DD, set on approval
shipped: 2026-11-25 # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes: # none
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§2.6'
  - '§2.7'
  - '§4.1'
  - '§5.1'
  - '§5.2'
  - '§5.4'
  - '§6.3'
constitution_overrides:
  - section: '§2.5'
    reason: 'Tabs, modal and scroll container are interactive; all touched components are already client components under the goal detail page.'
---

# Spec 198: Goal detail page, tabbed budget items and savings

## Problem

The owner likes the goal detail layout (`/dashboard/household/goals/[goalId]`),
the budget-vs-payment chart, the payments-over-time and savings-over-time side
charts and the audit log, but the items section is hard to use:

- Each budget item row (`goal-item-list.tsx`) carries only a name; there is no
  place for a short explanation of what the line is.
- Recording a payment happens in an inline form inside the expanded row, which
  makes the card tall and noisy.
- The accordion grows with every item, pushing the charts and audit log far
  below the fold.
- Budget items and savings are interleaved in one flow, and the only way to
  record a saving is the hidden "Add to goal" action
  (`add-contribution-dialog.tsx`, `addContribution` in `goal-actions.ts`).

## Constitution check

- Satisfies:
  - `§2.1`, `§5.1`, `§5.4`: item `description` is sealed with `encryptPayload`
    under the household key `K_h` exactly like `name`; the server never sees
    plaintext and no SQL filters, orders or aggregates the column.
  - `§2.2`, `§2.3`: item create/update stays inside the existing server actions
    (`saveGoal` path, `goal-actions.ts` item `seal`); each already calls
    `requireUserId()` then the vault DEK before DB access. No new route
    handlers.
  - `§2.4`, `§2.6`, `§2.7`: `page.tsx` is untouched and keeps composing the
    feature; new components are exported through the `src/features/household`
    barrel only if used outside the feature; named exports only.
  - `§5.2`: the new column lives on the existing RLS-protected
    `household_goal_items` table; no policy change is expected because policies
    are row-scoped, not column-scoped (verify in the migration review).
  - `§6.3`: one forward-only migration adds a nullable column; no rewrite.
  - `§4.1`: all five `pnpm` gates run before review.
- Overrides: `§2.5` (SOFT). The tabs, record-payment modal and scroll region
  need client state. `goal-detail.tsx` and `goal-item-list.tsx` are already
  `'use client'`; the new modal and tab components stay inside that boundary
  and add no new client entry point.

## Solution shape

Layout stays: two-column grid, left items section, right payments-over-time
chart plus `GoalActivity` audit log (`goal-detail.tsx` ~L316-390). Only the left
column changes.

### Items and Savings tabs

- Replace the single `Budget items` section with shadcn `Tabs`
  (`@/components/ui/tabs`) holding `Budget items (n)` and `Savings` tabs. Active
  tab is local state, default `Budget items`; if a goal has no items the default
  is `Savings` (Q3).
- Budget items tab keeps `ItemBreakdownBar`, `GoalItemList` and the existing
  `Add item` button and empty state.
- Savings tab is new and holds the goal's saved total vs target, the
  `Record saving` primary action and the list of existing contribution entries
  (Q4). The savings-over-time chart stays in the right column (`GoalBurnUpChart`,
  heading unchanged).

### Item card

- Row header shows: item name (title), small muted `description` below it,
  right side `paid / budget` (masked via `useAmountVisibility`), then a trash
  button (existing delete flow via `useDeleteGoalItem` plus `useUndoableDelete`;
  `ConfirmDeleteDialog` behaviour unchanged).
- The row still expands (accordion) to show the payment history list and the
  per-payment edit/delete controls (`EditPaymentDialog` unchanged).
- The inline add-payment form is removed from the expanded row. A
  `Record payment` button in the row opens a modal.

### Record payment modal

- New `src/features/household/components/record-payment-dialog.tsx`
  (`'use client'`, justified: controlled dialog and form state). Built on
  shadcn `Dialog` like `edit-payment-dialog.tsx`. Fields: amount, date
  (default today), optional note, `PaidByPicker` (existing, only when
  `usePaidByEnabled()`).
- Reuses `useAddItemPayment`, `addItemPaymentSchema` and `invalidProps` /
  `omitError` from `lib/form-errors.ts`; same validation, same cache
  invalidation. The inline form code and its local state in
  `goal-item-list.tsx` are deleted, not duplicated.
- Payer copy stays as-is: existing `You` / `Partner` wording in `PaidByPicker`
  and the payment rows is not changed. Multi-member payer work is spec 200.

### Visible-row cap

- The item list shows at most `GOAL_ITEM_VISIBLE_ROWS = 5` rows before scrolling
  (new constant in `constants.ts`). Implemented as a `max-h` on the `<ul>`
  derived from the collapsed row height with `overflow-y-auto` and
  `overscroll-contain`, so the scroll is discoverable. All rows remain in DOM
  order and keyboard focusable; an expanded row scrolls inside the container.
  Proposed value 5 (Q2).

### Item description (data)

- Current state: `household_goal_items` seals only `name`, `budget` and `quote`
  as separate encrypted columns (`seal()` in `goal-actions.ts`, ~L637);
  `GoalItem` in `types.ts` has no description. The field is therefore new and
  needs a column, not just a payload change (Q1).
- Add optional `description` (max 120 chars, trimmed, blank stored as null):
  - Migration `supabase/migrations/<timestamp>_household_goal_item_description.sql`:
    `alter table household_goal_items add column description text;` (nullable,
    holds the same `encryptPayload` ciphertext format as `name`; no default, no
    index, no backfill). Existing rows read as `null`.
  - `schemas.ts`: add `description` (`z.string().trim().max(120).nullish()`) to
    `addGoalItemSchema` and `saveGoalItemSchema`.
  - `goal-actions.ts`: select `description` where item rows are read, decrypt
    it in the mapping, seal it in `seal()`, and include it in the "unchanged"
    comparison. `lib/goal-delta.ts` (audit log) compares it so edits are
    logged as item edits.
  - `types.ts`: `GoalItem.description: string | null`.
  - `add-goal-item-dialog.tsx` and `goal-editor-sheet.tsx`: add the optional
    description input next to the name field.
- Encryption-touching paths flagged: `seal()`, the item read/decrypt mapper and
  the goal-delta comparison.

### Record saving (Savings tab)

- The hidden "Add to goal" action becomes a clearly visible primary
  `Record saving` button in the Savings tab (owner decision 2026-11-25). It
  opens the existing `AddContributionDialog` (title and button copy changed
  from "Add to goal" to "Record saving"); `addContribution` in
  `goal-actions.ts` and its schema are unchanged.
- The goal card's contribute entry (`goal-list.tsx` / `goal-card.tsx`) keeps
  working and its label is renamed to match (see ownership below).
- Savings model is unchanged. The planner keeps deducting each dated goal's
  derived monthly pace: `monthlyPaceNeeded` (`lib/goal-stats.ts:31`) feeding
  `household-plan.ts` and `salary-planner.tsx` (~L385-407). There is no new
  per-goal monthly savings field, no new column and no change to those
  modules.

### Files touched (ownership)

Owned by 198: `components/goal-detail.tsx`, `components/goal-item-list.tsx`,
`components/record-payment-dialog.tsx` (new), `components/add-goal-item-dialog.tsx`,
`components/add-contribution-dialog.tsx` (copy only),
`components/goal-editor-sheet.tsx` (description field), `actions/goal-actions.ts`
(description only), `lib/goal-delta.ts`, `schemas.ts`, `types.ts`, `constants.ts`
(row-cap constant), the new migration, and tests under `test/features/household/`.

Shared with spec 199: `components/goal-card.tsx` (198 only renames the
contribute label; 199 owns every other edit) and `constants.ts` (separate
lines). `components/goal-list.tsx` is not edited by 198. If 199 lands first and
already renamed the label, 198 drops that edit.

Spec 200 (multi-member payers) owns `paid-by-picker.tsx` and payer copy; 198
only mounts it in the new modal.

## Out of scope

- Savings model, planner pace maths, any new per-goal monthly field.
- Multi-member payer UI and copy (spec 200).
- Household page layout and routes (spec 199).
- Changes to the charts, `ItemBreakdownBar` logic or audit log content beyond
  surfacing the description edit.
- Virtualisation of the item list.
- Any SQL filtering, sorting or search on encrypted columns.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green
- [ ] Items and Savings render in separate tabs; charts and audit log unchanged
      and still visible beside them
- [ ] Item card shows title, small description (only when set), `paid / budget`
      and a trash button; trash keeps the undo/confirm behaviour
- [ ] `Record payment` opens a modal; no inline payment form remains; adding a
      payment updates `paid` and the charts; validation errors show in the modal
- [ ] More than 5 items scroll inside the list; 5 or fewer show no scrollbar;
      all rows remain keyboard reachable
- [ ] `Record saving` is a visible primary button in the Savings tab and opens
      the dialog; `addContribution` unchanged; planner output for an existing
      dated goal unchanged
- [ ] Existing items without a description render without an empty gap
- [ ] Description round-trips encrypted: the stored value is ciphertext, never
      plaintext (action test on the sealed payload)
- [ ] Migration is forward-only and nullable
- [ ] Spec hash matches at impl PR time

Test plan (vitest, node default, `// @vitest-environment jsdom` per file for
component tests, under `test/features/household/`):

- Update `goal-item-list.test.tsx`: card layout, trash, modal opens, no inline
  form, row-cap scroll container.
- New `record-payment-dialog.test.tsx` (jsdom): validation, submit payload,
  paid-by picker gating.
- Update `goal-detail.test.tsx` and `goal-detail-parts.test.tsx`: tabs, default
  tab, `Record saving` visible and opening the dialog, charts present.
- Update `goal-actions.test.ts` (node): description sealed, blank to null,
  unchanged-detection includes description, read decrypts it.
- Update `goal-delta.test.ts` (node): description edit logged.
- Planner regression: existing `salary-plan-household.test.ts` and household
  plan tests pass untouched.

## Risk & reversibility

- **Blast radius**: goal detail page UI and the item create/update path; one
  new nullable column. Payments, contributions and planner maths are untouched.
- **Reversibility**: UI changes revert with a git revert. The column is
  additive and nullable, so a code revert leaves it harmlessly unused; per
  `§6.3` it is dropped only by a later forward migration.
- **Backout plan**: revert the impl commit; leave the column; if removal is
  wanted, a follow-up spec adds a forward migration.

## Open questions

- [x] Q1: DEFERRED to follow-up slice 198b. Migrations need separate owner approval (AGENTS 5). This slice ships the card layout (title left, `paid / budget` then trash right) with no description line, no migration, no schema/action change. The `Item description (data)` section and its acceptance items move to 198b. — Owner: Clarence, resolved 2026-11-25
- [x] Q2: Cap of 5 (`GOAL_ITEM_VISIBLE_ROWS`), scroll beyond, rows keyboard reachable. — resolved 2026-11-25
- [x] Q3: Default tab Budget items when any item exists, else Savings. — resolved 2026-11-25
- [x] Q4: Savings tab lists past contributions (existing data/components) and has a visible primary `Record saving` button opening the existing add-contribution dialog; the old hidden `Add to goal` trigger is removed. — resolved 2026-11-25
