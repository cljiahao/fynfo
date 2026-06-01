---
id: 015
slug: action-tests
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence approved Phase 2 of the 2026-06-02 audit roadmap (track selection)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # adds the missing tests for the encrypted server actions
  - '§2.1' # asserts plaintext never reaches Supabase; round-trips the AES-256-GCM field encryption
  - '§4' # asserts boundary Zod validation rejects bad input before any DB access
constitution_overrides:
---

# Spec 015: Unit tests for the encrypted server actions (expenses, salary)

## Problem

The audit (`docs/audit/2026-06-02-project-audit-roadmap.md`, HIGH #5) found all server actions
untested. They own the encrypt-on-write / decrypt-on-read contract and the boundary validation that
keep the vault zero-knowledge. Spec 014 covered the crypto/guard primitives; this spec covers the
actions that compose them, prioritising the two highest-traffic feature surfaces: expenses and
salary. Node-testable with the existing setup — **no new dependency**.

## Constitution check

- Satisfies:
  - `§4.2` — characterization tests for `getExpenses`/`upsertExpense`/`deleteExpense`/
    `getDistinctPeople` and `getSalaryRecords`/`getSalaryRecord`/`upsertSalaryRecord`/
    `deleteSalaryRecord`.
  - `§2.1` — asserts each write encrypts its sensitive fields (the payload sent to Supabase decrypts
    back to the input, and is NOT the plaintext), and each read decrypts correctly. Confirms split
    `person` is plaintext by design while split `amount` is encrypted.
  - `§4` — asserts `parseOrThrow` rejects invalid input (bad amount / month) before any Supabase
    call, and that `throwIfSupabaseError` surfaces an opaque `AppError` (no DB text) on DB failure.
- Overrides: none. No HARD rule touched. No new dependency. No production code change. No migration.

## Solution shape

Test files + one shared mock helper, under `test/`:

- `test/helpers/fake-supabase.ts` — a chainable Supabase stub: `from().select().eq().order()` /
  `.in()` / `.single()` resolve to a configurable `{ data, error }`; `upsert`/`insert`/`update`/
  `delete` record their payloads and return a configurable error. Lets action tests assert exactly
  what was sent to the DB without a live client.
- `test/features/expenses/expense-actions.test.ts` — mock `@/lib/action-guard` to inject a real DEK
  - the fake client (so encrypt/decrypt genuinely round-trips). Cases: read decrypts rows + splits;
    read surfaces `AppError` on DB error; upsert encrypts item/info/amount (decrypt-back equals input,
    ciphertext ≠ plaintext), sets `split_type`, clears stale splits, inserts encrypted split amounts
    with plaintext person; upsert rejects invalid input before any DB call; delete filters by id+user;
    `getDistinctPeople` dedupes + sorts.
- `test/features/salary/salary-actions.test.ts` — same mock pattern. Cases: read decrypts
  salary/bonus; `getSalaryRecord` returns null on error/no-data and decrypts on success; upsert
  encrypts salary/bonus (decrypt-back equals) and sets month; upsert rejects invalid input; delete
  filters by user+month.

## Out of scope

- The other 7 actions (equity, profile, planner, relief, snapshot, statement, price) — can follow the
  same pattern later; expenses + salary establish it.
- Coverage thresholds — `016-coverage-thresholds`.
- Any production code change. The audit's invalidation/DRY refactors are separate specs.

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [ ] `pnpm test:ci` green; new tests cover the cases above.
- [ ] `pnpm build` green
- [ ] No production source file changed (test files + helper + this spec only).
- [ ] No `any`, no `console.log`, no new dependency.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: none on runtime — test-only.
- **Reversibility**: `git revert` the impl commit.
- **Backout plan**: delete the test files + helper.

## Open questions

- None.
