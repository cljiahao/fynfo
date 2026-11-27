---
id: '202'
slug: goal-item-edit-dialogs
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-27
approved: 2026-11-27 # approved_by Clarence, conversationally ("option A"), for exactly this design
shipped: 2026-11-27 # YYYY-MM-DD, set on impl merge
impl_pr: 3dba6f9 # direct to main, commit sha
supersedes: # none
constitution_satisfies:
  - '§1.1'
  - '§2.2'
  - '§2.3'
  - '§4'
  - '§5.1'
  - '§5.1a'
constitution_overrides: []
---

# Spec 202: Goal item edit dialogs

## Problem

On the household goal page a budget item can only be added or deleted; fixing a typo, an amount or
a quote means deleting it and losing its payments. The goal create and edit side sheet also mixes
two jobs: naming the goal and editing every budget line behind a review step.

## Constitution check

- Satisfies §1.1, §5.1 and §5.1a: item fields are sealed under K_h with the same helpers as the
  create path, so the server stores ciphertext only.
- Satisfies §2.2 and §2.3: mutation is a server action in `features/household/actions/`, behind
  `requireHouseholdContext`, which resolves the user and K_h before any DB access.
- Satisfies §4: input is validated with Zod at the boundary, errors are opaque, no `any`.
- No HARD rule is touched. No migration: the `household_goal_items` UPDATE policy and the
  `description` column already exist.

## Solution shape

- Item edit: a pencil button next to the trash button on each item card opens `AddGoalItemDialog`
  in an edit mode (`item` prop), prefilled with title, description (120 chars), estimate, optional
  final quote and due date.
- `updateGoalItem(input)` in `goal-actions.ts`: `updateGoalItemSchema` (`safeParse` through
  `parseOrThrow`), seals name, budget, quote and description under K_h, then one UPDATE scoped by
  row id. RLS keeps it inside the caller's household; zero matched rows is `NOT_FOUND`, never raw
  Postgres text. Household scope comes from RLS plus the zero-row `NOT_FOUND` check, the same as
  `deleteGoalItem`. A blank quote or description is stored as NULL.
- Goal create and edit become a centered Dialog (`goal-editor-dialog.tsx`, replacing the sheet).
  Fields: name, target amount, target date, plus the existing optional "Different split"
  disclosure. Create keeps "Break down the cost" with the "Start from a template" picker that
  seeds item lines. Edit has no item lines and saves through the existing `updateGoal` action, so
  it cannot touch items. The review/confirm step is removed.
- Goal page hint on the Budget items tab: "Items total $X vs target $Y", with X the sum over items
  of `quote ?? budget`. It replaces the target delta the sheet used to show, so `goal-delta.ts`
  is replaced by `goal-items-total.ts`.
- All edit controls (item pencil, goal dialog fields and submit) are disabled while amounts are
  hidden, like the existing edit buttons.

## Out of scope

Editing item lines from the goal dialog, K_h rotation, bulk item edits, migrations.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] Tests: `updateGoalItem` valid update, validation rejection, sealed fields, row outside the household rejected; item dialog edit prefill and submit; edit goal dialog has no item lines; create template seeds items; items-total calc and hint

## Risk & reversibility

- **Blast radius**: household goal page and goal create/edit flow. Editing a goal no longer sends
  items, so it cannot delete or rewrite them.
- **Reversibility**: code only; no schema change.
- **Backout plan**: revert the commit.

## Open questions

None.
