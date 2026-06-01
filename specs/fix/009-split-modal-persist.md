---
id: 009
slug: split-modal-persist
area: fix
status: draft # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-05-29)
created: 2026-05-29
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes:
constitution_satisfies:
  - '§4.2' # bugfix requires a regression test (fails on main, passes on PR)
  - '§2.3' # save path keeps requireUserId() → getVaultDekSession() ordering (unchanged action)
  - '§2.1' # split amounts stay AES-256-GCM encrypted via the existing upsert action
constitution_overrides:
---

# Spec 009: Persist split changes when confirming the expense split modal

## Problem

On the expenses page, editing the Shared/Self split on an **existing** row does not persist.
Flow: open a saved expense row → switch split to Shared → open the split modal → add/edit people
and amounts → click **Confirm**. The row's UI updates, but nothing is written to the database.
On refresh the split is gone (and the row falls back to its last-saved state). The user loses
every split they entered through the modal.

Root cause is in `src/features/expenses/components/expense-table.tsx`. The modal's `onConfirm`
handler only mutates local component state:

```ts
const handleSplitConfirm = (splits: ExpenseSplitData[]) => {
  update({ splits }); // local state only — never calls onSave
};
```

Persistence for existing rows otherwise relies on the row blur-save (`handleRowBlur`). But that
path never fires after a modal confirm:

- While the dialog is open, the row blur is intentionally suppressed by the `splitDialogOpenRef`
  guard (`expense-table.tsx:147-157`) — this guard was added by commit `8f6c5be` to stop a stale
  `splitType: 'self'` save from clobbering the Shared selection.
- When the dialog closes, focus returns to the trigger button **inside** the row, so
  `handleRowBlur` early-returns on `e.currentTarget.contains(e.relatedTarget)` (line 142). No blur,
  no scheduled save.

Net: confirm updates the UI but never reaches `onSave` → `upsert.mutateAsync` → the encrypted
server action. The split is lost.

Second, latent bug: `SplitDialog` initializes its working copy with `useState(initialSplits)`
(`split-dialog.tsx:36`) and the dialog instance is never remounted (no `key`). React `useState`
ignores prop changes after mount, so reopening the modal on a row whose splits changed since first
open shows **stale** splits.

## Constitution check

- Satisfies:
  - `§4.2` — bugfix ships a regression test that fails on `main` and passes on the fix.
  - `§2.3` — the fix calls the existing `onSave` (`handleSave` → `useUpsertExpense` →
    `upsertExpense` action), which already does `requireUserId()` then `getVaultDekSession()`. No
    change to that ordering.
  - `§2.1` — split amounts are part of the expense payload encrypted by the existing action via
    `encryptPayload`. The fix changes only _when_ the save fires (client-side), never _how_ the
    payload is encrypted. No new plaintext reaches Supabase.
- Overrides: none.
- No HARD rule touched. No new dependency. No migration. No `'use client'` added (file is already a
  client component).

## Solution shape

All edits in `src/features/expenses/components/expense-table.tsx` and
`src/features/expenses/components/split-dialog.tsx`. No action, hook, schema, type, or migration
changes.

- **Persist on confirm** (`expense-table.tsx`, `handleSplitConfirm`): after updating local state,
  persist immediately for existing, valid rows by calling the existing `onSave`:

  ```ts
  const handleSplitConfirm = (splits: ExpenseSplitData[]) => {
    const next = { ...data, splits, id: data.id || generateId() };
    setData(next);
    if (!isNew && next.date && next.amount > 0) onSave(next);
  };
  ```

  - New rows (`isNew`) keep saving via the existing Enter/blur path — confirming the modal only
    stages the splits locally, exactly as today, so an incomplete new row is not prematurely
    written.
  - The validity guard (`date` + `amount > 0`) mirrors `handleSave`/`handleRowBlur`, so the modal
    cannot trigger a save the manual paths would reject.
  - Reuses the same `onSave` → `useUpsertExpense` mutation; no new persistence surface.

- **Fix stale modal state** (`split-dialog.tsx`): resync the dialog's working copy to
  `initialSplits` each time it opens, via an **effect-on-open reset** (effect keyed on `open`) that
  resets `splits` plus the `paidFor`/`newName` UI state on the closed→open transition. Decided
  (open Q1): effect-on-open, not parent `key`-remount — keeps open-state tracking inside the dialog
  and out of `expense-table.tsx`.

- **Toast on confirm** (open Q2): confirming the modal on an existing valid row routes through the
  existing `onSave` → `handleSave`, so the current `toast.success('Expense saved')` fires
  unchanged. No silent-save branch; feedback stays consistent with Enter/blur saves.

- No change to `handleRowBlur`, the `splitDialogOpenRef` guard, or the `8f6c5be` self/shared guard —
  those stay as-is.

## Out of scope

- The statement-import modal (`statement-dialog.tsx`) — its `Save N Expenses` button already
  persists via `upsert.mutateAsync` and is unaffected.
- Any change to the `upsertExpense` server action, schemas, types, encryption, or Supabase schema.
- Reworking the blur-save / debounce mechanism beyond the confirm path.
- The owed-summary / chart components.
- Visual or UX redesign of the split modal.

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [ ] `pnpm test:ci` green; new regression test asserts confirming the split modal on an existing
      valid row invokes the upsert/`onSave` with the new `splits` (test fails on `main`, passes on
      fix).
- [ ] `pnpm build` green
- [ ] Manual: open a saved expense, switch to Shared, add a person + amounts, Confirm → reload page
      → split persists.
- [ ] Manual: confirming the modal on a **new** (unsaved, blank) row does not prematurely write a
      row; it still saves only on Enter/blur with a valid date + amount.
- [ ] Manual: open modal on row A, confirm; reopen modal on the same row → shows the just-saved
      splits, not stale data.
- [ ] No `any`, no `console.log`, no new dependency, no files outside the two listed.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: expenses page only; single component pair. Worst case a confirm fires an extra
  upsert — idempotent (upsert by id), already the save path used elsewhere. No data-shape change.
- **Reversibility**: single `git revert` of the impl commit. No migration, no schema, no data
  backfill.
- **Backout plan**: revert the impl PR commit; behavior returns to current (splits not persisting).

## Open questions

- [x] Q: Stale-modal fix — effect-on-`open` reset inside `SplitDialog`, or `key`-based remount from
      the parent? — Owner: Clarence — A (2026-06-01): effect-on-`open` reset inside `SplitDialog`.
- [x] Q: Should confirming the modal show the "Expense saved" toast (current `handleSave` behavior)
      for existing rows, or save silently? — Owner: Clarence — A (2026-06-01): show the toast (route
      through existing `onSave`/`handleSave`; no silent branch).
