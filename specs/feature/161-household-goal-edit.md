---
id: '161'
slug: household-goal-edit
area: feature
status: draft # draft | approved | shipped | superseded
author: Claude Code
created: 2026-10-30
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§4.1'
  - '§5.1a'
  - '§5.2'
  - '§5.4'
constitution_overrides:
---

# Spec 161: Edit a household goal

## Problem

Owner report on `/dashboard/household`: "not able to edit the total amount".
A goal's name, target amount and target date are fixed at creation. If the
target price of a sofa changes, or a date slips, the only option is to delete
the goal, which also deletes every contribution and budget item under it
(cascade). The feature was never built: `src/features/household/actions/goal-actions.ts`
exports `createGoal`, `addContribution`, `deleteGoal` and the item/payment
actions, but no `updateGoal`, and `goal-card.tsx` has no edit control.

## Constitution check

- Satisfies: `§1.1` (household-scoped data only), `§2.1` (name and target
  amount re-sealed with `encryptPayload` before reaching Supabase), `§2.2`
  (mutation is a server action in `features/household/actions/`), `§2.3`
  (identity first, then `K_h` via `requireHouseholdContext()`), `§4.1` (all
  gates), `§5.1a` (existing `K_h` only; no new key or crypto protocol), `§5.2`
  (existing RLS UPDATE policy is the floor), `§5.4` (no filtering on encrypted
  columns; the update filters on plaintext `id` only).
- Overrides: none.

## Solution shape

- **No migration.** The database already allows this: the policy
  `"Members update goals"` (`supabase/migrations/20260627000000_add_household_goals.sql:49-51`,
  `FOR UPDATE USING (public.is_household_member(household_id))`) and
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_goals`
  (same file, line 83). The `REVOKE UPDATE` in
  `supabase/migrations/20261023000149_household_project_items.sql:95-96` applies
  only to `household_goal_items` and `household_goal_payments`, not to goals.
  The policy has no `WITH CHECK`, so Postgres reuses `USING` for the new row;
  `household_id` is never written by this action, so it cannot move.
- **Schema** (`src/features/household/schemas.ts`): add
  `updateGoalSchema = createGoalSchema.extend({ goalId: z.uuid() })` and
  `UpdateGoalInput`. Reuses the name (trimmed, 1-80), `targetAmount`
  (positive, finite) and optional ISO `targetDate` rules unchanged.
- **Action** (`src/features/household/actions/goal-actions.ts`), new
  `updateGoal(input: unknown): Promise<void>`:
  1. `parseOrThrow(updateGoalSchema, input, 'household.goal.update.input')`
     first (opaque `AppError('VALIDATION')` on failure).
  2. `requireHouseholdContext()` for `{ kh, supabase }`.
  3. Update `household_goals` setting `name` and `target_amount` to
     `encryptPayload(..., kh)` output (amount via `toString()`, as in
     `createGoal`) and `target_date` to `targetDate ?? null`, filtered with
     `.eq('id', goalId)` and chained `.select('id')`, then
     `throwIfSupabaseError(error, 'household goal update')`.
  4. If the returned rows are empty (RLS hid the row, wrong id, or already
     deleted), throw `new AppError('NOT_FOUND', 'Goal not found')`. Never
     report success on zero rows: an RLS-filtered UPDATE returns no error and
     no rows, which would otherwise look like a save.
  - Omitting `targetDate` clears it (`null`), so the edit dialog can remove a
    date. `created_by`, `household_id`, contributions and items are untouched.
  - Encryption-touching path: name and target amount, same sealing as
    `createGoal`.
- **Hook** (`src/features/household/hooks/use-household.ts`): `useUpdateGoal()`
  via the existing `useGoalsMutation(updateGoal)` helper, which refreshes
  `GOALS_KEY` on success.
- **Dialog** (`src/features/household/components/create-goal-dialog.tsx`):
  add an optional `goal?: HouseholdGoal | null` prop. When set, the dialog is
  in edit mode: fields prefilled from the goal (target date sliced to
  `yyyy-MM-dd`), title "Edit goal", submit label "Save changes", calls
  `useUpdateGoal` with `goalId`, toasts "Goal updated" / "Could not update the
  goal". When absent, behaviour is unchanged. Initial state is seeded from the
  prop; the caller mounts the dialog with `key={goal.id}` so switching goals
  re-seeds without an effect (the repo lint forbids set-state-in-effect).
  Keeps the existing `useAmountVisibility` gating (`canReveal()`,
  `AmountsHiddenNotice`, inputs disabled and blank while amounts are hidden).
- **Card** (`src/features/household/components/goal-card.tsx`): new
  `onEdit: (goal: HouseholdGoal) => void` prop and a `Pencil` ghost icon
  button beside the existing delete button, mirroring its affordance:
  `size="sm"`, `variant="ghost"`, `disabled={hidden}`, click handler guarded
  by `canReveal()`, and an `aria-label` of "Edit goal" plus the masked name.
- **List** (`src/features/household/components/goal-list.tsx`): hold
  `editing: HouseholdGoal | null` state (same pattern as `contributingTo`),
  pass `onEdit={setEditing}` to each card, and render `CreateGoalDialog` with
  `goal={editing}`, `open={editing !== null}`, `key={editing?.id}` and an
  `onOpenChange` that clears `editing` on close.
- **Tests**:
  - `test/features/household/goal-actions.test.ts` (existing file, fake
    Supabase): `updateGoal` rejects invalid input (bad uuid, non-positive or
    non-finite amount, empty name, bad date) before any DB call; sends
    ciphertext for `name` and `target_amount` (never the plaintext) and filters
    on `id`; omitted date writes `null`; zero rows updated throws `AppError`
    `NOT_FOUND`; a Supabase error throws the opaque `household goal update failed`.
  - New `test/features/household/goal-edit.test.tsx` (jsdom per-file opt-in,
    as in `goal-card.test.tsx`): edit button calls `onEdit`; dialog opens
    prefilled with "Edit goal" / "Save changes"; saving calls `updateGoal`
    with the edited values and `goalId`; failure shows the error toast and
    keeps the dialog open; after the goals query refreshes, the card shows the
    new target and recomputed progress (funded when the new target is at or
    below contributions).
- No new dependencies. No `any`, no lint suppressions.

Files to change: `src/features/household/schemas.ts`,
`src/features/household/actions/goal-actions.ts`,
`src/features/household/hooks/use-household.ts`,
`src/features/household/components/create-goal-dialog.tsx`,
`src/features/household/components/goal-card.tsx`,
`src/features/household/components/goal-list.tsx`,
`test/features/household/goal-actions.test.ts`, and the new
`test/features/household/goal-edit.test.tsx`. Existing
`test/features/household/goal-card.test.tsx` needs the new required `onEdit`
prop in its render helper.

## Out of scope

- Editing budget item amounts or payments in `project-breakdown.tsx`. Items and
  payments are insert/delete-only by design
  (`supabase/migrations/20261023000149_household_project_items.sql:95-96`);
  correcting one stays delete and re-add.
- Editing or deleting contributions.
- Any migration, RLS change, new column or new dependency.
- Changing who may edit: any household member may, matching the existing
  update policy and the delete behaviour.
- Audit trail or edit history of target changes.
- Personal (non-household) features.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests cover input validation, ciphertext-only
      write, null date, zero-row failure, dialog prefill and save, and card
      refresh
- [ ] `pnpm build` green
- [ ] Manual (owner): on `/dashboard/household`, edit a goal's target amount;
      the card shows the new target, remaining and percentage; contributions and
      budget items are intact; the partner account sees the same change after
      refresh
- [ ] Manual: lowering the target below the contributed total shows "Funded"
- [ ] Manual: with amounts hidden the edit button is disabled and fields blank
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

Low. Additive server action and UI; no schema change, so revert is a code
revert. Overwriting a goal is last-write-wins between the two members (no
version column); acceptable for a two-person household and recoverable by
editing again. Lowering a target below contributions is allowed and simply
marks the goal funded. Failure mode is closed: validation, auth, `K_h` and
zero-row checks all throw opaque errors, and nothing reports success on a
no-op.

## Open questions

1. Should clearing the target date be supported? This spec says yes: an
   omitted date writes `null`. The alternative keeps the old date unless a new
   one is supplied.
2. Allow a target below the already-contributed total? This spec says yes (the
   goal shows Funded); the alternative rejects it.
