---
id: 048
slug: expense-quickadd-reset-on-submit
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-24)
created: 2026-06-24
approved: 2026-06-24 # Clarence approved via spec+implement-together; PR ceremony waived (personal project, direct-to-main)
shipped: 2026-06-24
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # bugfix ships a regression test (fails on main, passes on fix)
  - '§2.1' # no encryption change; reuses the already-decrypted optimistic cache, no new plaintext path
constitution_overrides:
---

# Spec 048: Clear Quick Add immediately on submit (reset-on-submit, save in background)

## Problem

On the expenses page, every time a row is keyed into Quick Add the input fields stay full until
the save round-trips to the Pi. Spec 011 already removed the full-list refetch and the mutation's
`onMutate` inserts the row into the table optimistically, so the **table** updates instantly — but
the **form** does not. `handleSubmit` `await`s `upsert.mutateAsync(...)` and only calls `resetForm()`
in the `.then()`/post-`await` path, so the fields don't clear until the server responds. The user has
to wait between rows before keying the next expense. Both paste handlers have the same shape.

Root cause — `src/features/expenses/components/expense-quick-add.tsx`:

```ts
// handleSubmit (155-167)
await upsert.mutateAsync({ ... });   // waits for server round-trip
toast.success('Expense added');
resetForm();                          // only clears AFTER the await resolves
```

The same `await mutateAsync(...).then(resetForm)` pattern repeats in the single-row paste path
(83-101) and the multi-row paste path (121-145).

The consensus pattern for rapid repeated data entry is optimistic UI + **reset-on-submit**: clear
the form the instant the row is fired, let the save complete in the background, and roll back +
notify on failure. The hook already provides the optimistic insert (`onMutate`) and the rollback
(`onError`); only the component's reset timing needs to change.

## Constitution check

- Satisfies:
  - `§4.2` — ships a regression test that fails on `main` and passes on the fix: asserts
    `handleSubmit` resets the form synchronously (fields cleared) without awaiting the mutation, i.e.
    the reset does not block on the server promise.
  - `§2.1` — no encryption code touched. The data being reset/cleared is plaintext the user just
    typed; the optimistic cache (already decrypted) is the source of truth. No new plaintext path,
    no new decrypt, no schema/migration.
- Overrides: none. No HARD rule touched. No new dependency. No migration. `expense-quick-add.tsx` is
  already a `'use client'` module — no new client boundary.

## Solution shape

All edits in `src/features/expenses/components/expense-quick-add.tsx`. Switch the three submit paths
from `await mutateAsync(...).then(reset)` to fire-and-forget `mutate(..., { onSuccess, onError })`
followed by an **immediate** `resetForm()`. The hook's `onMutate` already shows the row before the
server answers and `onError` already rolls it back, so resetting before the promise settles is safe.

- **`handleSubmit` (155-171).** Validate (unchanged). Call `upsert.mutate(payload, { onSuccess:
() => toast.success('Expense added'), onError: () => toast.error('Failed to add expense — removed
from list') })`, then `resetForm()` synchronously. Drop the `async`/`await`/`try-catch`. Net: the
  fields clear and `typeRef` re-focuses immediately; the row is already in the table via `onMutate`;
  a save failure rolls the row back (existing `onError` in the hook) and shows the error toast.
- **Single-row paste (61-106).** When the parsed row is complete, replace the
  `mutateAsync().then(reset).catch(...)` with `mutate(payload, { onSuccess/onError toasts })` +
  immediate `resetForm()`. The incomplete-row branch (102-104, fill-the-rest) is unchanged.
- **Multi-row paste (109-145).** Fire each valid row with `mutate(...)` (no `await`/`Promise.all`)
  and `resetForm()` immediately; keep the existing summary toast (`N added, M skipped`) but emit it
  up-front from the synchronous counts rather than after a settled `Promise.all`. Per-row failures
  surface via the hook's `onError` rollback; a lightweight per-row error toast is acceptable. The
  "no valid rows" guard (116-119) is unchanged.
- **Error-message wording.** On failure the optimistic row disappears (rollback). The toast must say
  so ("removed from list") so the user knows to re-key, since the fields are already cleared. This is
  the explicit eventual-consistency tradeoff: a rare failed save loses the typed input.

Leave `disabled={upsert.isPending}` on the Add button (321) as-is. Enter-to-submit (`handleKeyDown`,
173-178) is not gated by `isPending`, so keyboard entry — the primary flow — stays fully unblocked;
the button only greys briefly for click-users, which also guards against accidental double-submit.

No change to `use-expenses.ts`, `upsertExpense`, the server actions, encryption helpers, schemas,
types, or Supabase schema.

## Out of scope

- The `disabled={upsert.isPending}` button gate — intentionally kept (see above). Unblocking the
  button for click-driven rapid entry is a separate, lower-value change.
- `use-expenses.ts` mutation/optimistic/rollback logic — spec 011 owns it; reused as-is.
- Delete / settle-split / settle-month paths — not the keyed-entry hot path.
- Any change to `upsertExpense`, server actions, encryption, schemas, types, or Supabase schema.
- Dashboard-after-PIN load time (spec 011 open question) — unrelated.

## Acceptance

- [ ] `pnpm format:check` + `pnpm lint` (max-warnings=0) + `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new regression test asserts `handleSubmit` clears the form fields
      without awaiting the mutation promise (fails on `main` where reset is post-`await`, passes on
      the fix). If the component is not directly testable in the node-env vitest setup without
      jsdom/RTL, extract the submit/reset decision into a pure helper and test that; otherwise add a
      per-file jsdom opt-in component test per the existing infra (spec 002 component-test-harness).
- [ ] `pnpm build` green
- [ ] Manual: key several rows back-to-back via Enter — fields clear instantly each time, focus
      returns to Category, table shows each row immediately, no wait between rows.
- [ ] Manual: paste a single complete Excel row — form clears immediately, row appears, toast fires.
- [ ] Manual: paste multiple rows — all valid rows appear, summary toast correct, form clears.
- [ ] Manual: force a save failure (offline) — the optimistic row rolls back and an error toast
      explains it was removed.
- [ ] No `any`, no `console.log`, no new dependency. Files: `expense-quick-add.tsx` + the new test.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: expenses Quick Add component only; no hook, action, schema, or encryption change.
  Worst case a save fails and the user loses the just-typed row (fields already cleared) — surfaced
  by the rollback + error toast; the user re-keys. Frequency is low (local self-hosted DB).
- **Reversibility**: single `git revert` of the impl commit. No migration, no schema, no data.
- **Backout plan**: revert the impl commit; behavior returns to await-then-reset.

## Open questions

- [ ] Q: On multi-row paste with a partial failure, is a per-row error toast acceptable (could be
      noisy for a large paste), or aggregate into one "M of N failed" toast after settle? — Owner:
      Clarence — A: (lean per-row for now; revisit if noisy)
