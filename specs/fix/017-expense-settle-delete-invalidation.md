---
id: 017
slug: expense-settle-delete-invalidation
area: fix
status: approved # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # audit HIGH #3; Clarence pre-approved roadmap fixes
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # ships unit tests for the optimistic cache contract
constitution_overrides:
---

# Spec 017 (fix): Optimistic delete/settle — stop full re-decrypt refetch

## Problem

Audit HIGH #3. Spec 011 established the expense cache contract: mutations write the result
optimistically and do **not** blanket-invalidate `EXPENSE_KEY`, because a refetch re-fetches and
re-decrypts every expense (expensive, janks the UI). Three sibling hooks still violate it:

- `useDeleteExpense` already removes the row optimistically, then **also** invalidates `EXPENSE_KEY`
  in `onSettled` — forcing the exact full re-decrypt the contract avoids.
- `useSettleSplit` and `useSettleMonthSplits` do **no** optimistic update and rely entirely on an
  `EXPENSE_KEY` invalidation — so every "mark settled" toggle re-decrypts the whole list before the
  checkbox reflects the change.

All three mutations are fully client-derivable (delete removes a row; settle flips a boolean on splits
matching a person), so the optimistic cache already equals server truth — no refetch is warranted.

## Constitution check

- Satisfies `§4.2` (adds unit tests for the new optimistic options). Overrides: none. No migration, no
  new dependency, no encryption-path change (these actions touch only plaintext `settled` / row
  identity).

## Solution shape

- `src/features/expenses/lib/utils.ts`: add a pure, unit-testable
  `applySplitSettlement(list, expenseIds, person, settled)` → returns a new list with `settled` flipped
  on every split whose `person` matches, for expenses whose id is in `expenseIds` (a single-element set
  is the `settleSplit` case; many ids is the month case). No mutation of inputs.
- `src/features/expenses/hooks/use-expenses.ts`: extract `buildDeleteMutationOptions(qc)`,
  `buildSettleSplitMutationOptions(qc)`, `buildSettleMonthMutationOptions(qc)` mirroring
  `buildUpsertMutationOptions`:
  - **delete**: keep optimistic removal + rollback; `onSettled` invalidates only `PEOPLE_KEY` (a
    removed expense can drop a person from suggestions), never `EXPENSE_KEY`.
  - **settle / settle-month**: `onMutate` applies `applySplitSettlement` optimistically, snapshot for
    rollback, `onError` restores; no `EXPENSE_KEY` (or `PEOPLE_KEY`) invalidation — the person set is
    unchanged.
  - The three `use*` hooks become one-line `useMutation(build…(useQueryClient()))` wrappers.
- Drift self-heals on the next natural `getExpenses` (mount / refresh / other invalidating mutation),
  exactly as the upsert path already documents.

## Out of scope

- The upsert path (already correct per spec 011).
- Any change to the server actions or the encrypted payload shape.
- Decomposing the oversized `expense-table.tsx` (separate Phase 3 item).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New tests: `applySplitSettlement` flips only the matched person/ids and is immutable; delete
      options invalidate `PEOPLE_KEY` but not `EXPENSE_KEY`; settle/settle-month options invalidate
      neither and optimistically flip the cache; rollback restores the snapshot on error.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: expense list cache only. Worst case a stale `settled`/row drift until the next
  natural refetch — same self-healing window the upsert path already relies on, and these mutations
  derive nothing the client lacks.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
