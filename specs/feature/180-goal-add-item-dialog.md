---
id: '180'
slug: goal-add-item-dialog
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-07
approved: 2026-11-07 # owner Clarence, chat, scope = this change only
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.4'
  - '§2.5'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.3'
  - '§5.1a'
constitution_overrides:
---

# Spec 180: Add item dialog on the goal detail page

## Problem

On the household goal detail page, "Add item" in the Budget items section opens
the full "Edit goal" sheet (spec 175, "Add item and Edit on the detail page open
this same Sheet"). Nothing says an item is being added, and the sheet asks for
the goal name and target, which the owner did not mean to change. This refines
spec 175 without reversing its other decisions: Edit keeps the sheet, only Add
item stops using it.

Owner approval: Clarence, chat, 2026-11-07, scope = this change only (first a
sheet add-item mode, then replaced in chat by the dialog below).

## Constitution check

- Satisfies: `§2.4` (page composes; the mutation is the existing hook),
  `§2.5` (new client component is a form with local state), `§3.1` (no new
  dependency), `§3.2` (existing `Dialog` primitive), `§4.1` and `§4.3` (the
  existing `saveGoal` action keeps its auth, vault and Zod checks; the dialog
  also validates with the shared item schema), `§5.1a` (item data is saved
  through the existing encrypted path; amounts-hidden gating is unchanged).
- Overrides: none.

## Solution shape

- New `src/features/household/components/add-goal-item-dialog.tsx`: a Dialog
  titled "Add budget item" with item name (required, max 80), estimate
  (required, above 0) and optional final quote. Name is autofocused, Enter
  submits, "Add item" is primary, Cancel closes. Inline field errors come from
  `saveGoalItemSchema`, now exported from `schemas.ts` rather than duplicated.
- Submit calls the existing `useSaveGoal()` with the goal's current name,
  target, target date and all existing items (id, name, budget, quote
  round-tripped to 2dp exactly as the editor sheet seeds them) plus the new
  item without an id. No review step and no new server action. Success toasts
  "Item added" and closes; failure toasts and keeps the dialog and input.
- `goal-detail.tsx`: the Budget items "Add item" button opens the dialog, gated
  by `hidden`/`canReveal()`. The existing items sent are built from the
  unfiltered `source` goal, never the `withoutPending` view, so an item in its
  undo-delete window is not deleted by an add. When `source.items.length` is at
  `GOAL_ITEM_LIMIT` the button is disabled with a title and
  `aria-describedby` reason.
- Edit and `GoalEditorSheet` are unchanged.

## Out of scope

- Any change to `GoalEditorSheet`, the goal list card, `saveGoal`, or the
  database.
- Editing or deleting items; adding payments.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green
- [ ] Tests: dialog opens with no goal fields; submit sends unchanged goal
      fields, existing items and the new item; invalid input is rejected
      inline; an item pending undo-delete is preserved; limit disables the
      button with a reason; failure keeps the dialog; Edit still opens "Edit
      goal"

## Risk & reversibility

- **Blast radius**: goal detail page only. `saveGoal` diffs by id, so a wrong
  item list would delete rows; mitigated by building from the unfiltered goal
  and a test.
- **Reversibility**: single git revert.
- **Backout plan**: revert the commit.

## Open questions

None.
