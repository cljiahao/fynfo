---
id: 011
slug: expense-quickadd-refetch
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-01)
created: 2026-06-01
approved: 2026-06-01 # Clarence approved; PR ceremony waived (personal project, direct-to-main)
shipped: 2026-06-01
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # bugfix ships a regression test (fails on main, passes on PR)
  - '§2.1' # no change to encryption; relies on already-decrypted optimistic cache, no new plaintext path
constitution_overrides:
---

# Spec 011: Stop full expense re-fetch + re-decrypt on every quick-add

## Problem

On the expenses page, adding a row through Quick Add is sluggish — after saving one row the
form is not ready fast enough to key the next row. Each save invalidates the entire `['expenses']`
query, forcing a full re-fetch of every expense from Supabase and a re-decrypt of every encrypted
field (item, info, amount, plus each split amount) for the whole list. The table re-renders while
that decryption is in flight, janking the form between rows. The work is redundant: the mutation's
`onMutate` already wrote the full new row (including splits) into the cache optimistically, so the
list is already correct on screen before the refetch begins.

Root cause — `src/features/expenses/hooks/use-expenses.ts:48-51`, `useUpsertExpense`:

```ts
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: EXPENSE_KEY }); // full list refetch + re-decrypt, every add
  queryClient.invalidateQueries({ queryKey: PEOPLE_KEY });
},
```

`onMutate` (lines 28-41) already inserts/updates the row in the `EXPENSE_KEY` cache from the
client-side `ExpenseData` (which carries the splits). `upsertExpense` is a pure upsert of
client-provided data and returns `void` — it computes no server-only fields the client lacks (id is
client-generated via `generateId`; date/amount round-trip through the same payload). So on the
success path the optimistic cache already equals the server truth; the blanket refetch buys nothing
but latency and decrypt churn.

## Constitution check

- Satisfies:
  - `§4.2` — ships a regression test that fails on `main` (asserts a full `EXPENSE_KEY` refetch is
    triggered on success) and passes on the fix (no success-path refetch; optimistic row stands).
  - `§2.1` — no encryption code touched. The fix removes a redundant decrypt pass; it never writes
    plaintext anywhere new. The optimistic cache already holds decrypted data the user just typed.
- Overrides: none. No HARD rule touched. No new dependency. No migration. No `'use client'` added
  (`use-expenses.ts` is already a client module).

## Solution shape

All edits in `src/features/expenses/hooks/use-expenses.ts`. The upsert mutation options are
extracted to an exported pure `buildUpsertMutationOptions(queryClient)` so the invalidation contract
is unit-testable in the node-env vitest setup (no jsdom/RTL in this repo — testing the hook directly
would need a new dependency). `useUpsertExpense` now just calls
`useMutation(buildUpsertMutationOptions(queryClient))`; behavior of the other hooks is unchanged.

- **Drop the success-path full refetch.** Remove the unconditional `EXPENSE_KEY` invalidation from
  `onSettled`. Keep the existing `onMutate` optimistic write as the source of truth on success and
  the existing `onError` rollback for the failure path. Net: a successful add leaves the optimistic
  row in place with no re-fetch and no re-decrypt.
- **Keep people-suggestions fresh, cheaply.** Retain the `PEOPLE_KEY` (`['expense-people']`)
  invalidation so a newly typed split person appears in suggestions. This query
  (`getDistinctPeople`) reads the `person` column, which `upsertExpense` stores in **plaintext**
  (only split `amount` is encrypted), so it does no per-row decrypt and is cheap to refetch.
- **Preserve error reconciliation.** On error, `onError` already restores `context.previous`. If a
  belt-and-suspenders refetch is wanted strictly on failure, scope it to `onError` (not
  `onSettled`), so the success path never pays for it. Decision deferred to impl; lean
  optimistic-only on success.

No change to `getExpenses`, `upsertExpense`, the encryption helpers, schemas, types, or the
component. The Quick Add and inline-edit save paths both call `useUpsertExpense`, so both benefit.

## Out of scope

- `useDeleteExpense` / `useSettleSplit` / `useSettleMonthSplits` refetch behavior — lower frequency,
  not the keyed-entry hot path. Leave their `EXPENSE_KEY` invalidations as-is.
- The blanket `queryClient.invalidateQueries()` on vault unlock
  (`vault-unlock-flow.tsx:103`) and overall dashboard-after-PIN load time — tracked separately; that
  needs a measurement spike before any fix (see Open questions). Not addressed here.
- Any change to `upsertExpense`, the server actions, encryption, schemas, types, or Supabase schema.
- Split-modal persistence — owned by spec 009.

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [ ] `pnpm test:ci` green; new regression test on `useUpsertExpense` asserts a successful upsert
      does NOT invalidate/refetch `EXPENSE_KEY` (test fails on `main`, passes on fix) and that the
      optimistic row remains in cache after settle.
- [ ] `pnpm build` green
- [ ] Manual: open Quick Add, key several rows back-to-back — each row commits and the form is
      immediately ready for the next with no visible table re-decrypt stall.
- [ ] Manual: a newly entered split person still appears in the people suggestions on the next row.
- [ ] Manual: force a save failure (e.g. offline) — the optimistic row rolls back via `onError`.
- [x] No `any`, no `console.log`, no new dependency. Files: `use-expenses.ts` + the new test.
- [x] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: expenses page only; one mutation hook. Worst case the optimistic cache drifts
  from server truth on the success path — bounded because `upsertExpense` derives no fields the
  client lacks, and any drift self-heals on the next natural `getExpenses` (page mount / manual
  refresh / other invalidating mutation).
- **Reversibility**: single `git revert` of the impl commit. No migration, no schema, no data
  backfill.
- **Backout plan**: revert the impl PR commit; behavior returns to current (full refetch per add).

## Open questions

- [ ] Q: Bug 1 (dashboard slow after PIN) — measure before fixing. Add temporary client timing
      around the `/api/vault` derive, the post-unlock invalidate, and each dashboard query's
      fetch+decrypt to find the real bottleneck (PBKDF2 derive vs network vs decrypt vs render)
      before committing to a fix. Should this be a separate `specs/fix/012` measurement spike, or
      folded into 011's impl PR? — Owner: Clarence — A:
- [ ] Q: On the failure path, refetch `EXPENSE_KEY` in `onError`, or trust the `context.previous`
      rollback alone? — Owner: Clarence — A: (lean rollback-only; confirm at approval)
