---
id: 032
slug: read-error-handling-consistency
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-14
approved: 2026-06-14
shipped: 2026-06-14
impl_pr: # direct-to-main per solo-project workflow
supersedes:
constitution_satisfies:
  - '§2.3' # readers that touch encrypted feature data
  - '§4.1' # gates green
  - '§4.2' # bugfix → regression test
  - '§4.4' # build green
constitution_overrides: # none
---

# Spec 032: Read actions throw on DB error instead of silently returning empty

## Problem

Two list readers swallow Supabase errors and return an empty array, while every other reader in the codebase throws an opaque `AppError` via `throwIfSupabaseError`. `getSnapshots` (`src/features/assets/actions/snapshot-actions.ts:27`, `if (error) return []`) and `getTrades` (`src/features/equity/actions/equity-actions.ts:21`, `if (error || !data) return []`) treat a real read failure — RLS rejection, connection drop, Postgrest error — as "the user has no assets / no trades." The dashboard then renders a confident empty state over a hidden failure, and nothing is logged server-side. `getSalaryRecords`, `getExpenses`, and `getDistinctPeople` already do the right thing (`throwIfSupabaseError(error, '<ctx> read')`), so this is an inconsistency bug, not a design choice.

## Constitution check

- Satisfies: `§2.3` (these readers touch encrypted feature data; behavior around the DB gate hardened, no auth/vault order change), `§4.1`, `§4.2` (regression tests added), `§4.4`.
- Overrides: none. No `HARD` rule touched. `throwIfSupabaseError` already logs the raw error server-side and throws an opaque `AppError('DB_ERROR', ...)`, so the AGENTS "error responses never leak Supabase/Postgres text" posture is satisfied (improved — previously the error was discarded entirely).
- No enforcement-layer or secret file touched. No new dependency. No migration.

## Solution shape

Mirror the established salary/expense reader pattern exactly. Single-row readers (`getSnapshot`, `getTrade`-equivalent) keep `if (error || !data) return null` — `.single()` legitimately errors on "no row found" (PGRST116), where `null` is the correct not-found signal. Only the list readers change.

- `src/features/assets/actions/snapshot-actions.ts` — `getSnapshots`: replace `if (error) return [];` with `throwIfSupabaseError(error, 'snapshots read');` then map over `data || []` (matches `getSalaryRecords`). `throwIfSupabaseError` is already imported.
- `src/features/equity/actions/equity-actions.ts` — `getTrades`: replace `if (error || !data) return [];` with `throwIfSupabaseError(error, 'trades read');` then map over `data || []`. Already imported.
- No change to `getSnapshot` (single-row, returns `null`), encryption paths, write actions, or `price-actions` (its per-symbol `catch → null` is deliberate external-API resilience, out of scope).

### Tests (new)

- `test/features/assets/snapshot-actions.test.ts` — mirror `salary-actions.test.ts` using `makeFakeSupabase` + the `@/lib/action-guard` mock: (a) `getSnapshots` decrypts entries on success; (b) **regression:** `getSnapshots` throws `'snapshots read failed'` when `selectError` is set (fails on `main`, passes here); (c) empty `selectData` → `[]`.
- `test/features/equity/equity-actions.test.ts` — same shape for `getTrades`: decrypt-on-success, **regression** throw-on-error, empty → `[]`.

## Out of scope

- `price-actions.ts` silent `catch` (intentional graceful degradation for the flaky Yahoo endpoint).
- D2 encrypt/decrypt boilerplate extraction — low value; the only real intra-file dup (snapshot entry decrypt across `getSnapshots`/`getSnapshot`) is cosmetic. Defer.
- D3 `'' as unknown as number` form-default cast — deliberate (number inputs render empty, not `0`); a proper fix is a form-amount coercion layer with UX implications. Defer to its own spec.
- D4 `SalaryPlanner`→`PlannerResults` prop drilling — the orchestration is untested at integration level; refactor needs test coverage first. Defer.
- crypto.ts / tax-cpf.ts tests — already comprehensively covered (`test/lib/crypto.test.ts`, `test/features/salary/tax-cpf.test.ts`). No work.

## Acceptance

- [x] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [x] `pnpm test:ci` green (291, +6); new `snapshot-actions` + `equity-actions` tests pass, including the throw-on-error regression cases
- [x] `pnpm build` green
- [x] Spec hash matches at impl time (single-session impl)

## Risk & reversibility

- **Blast radius:** two read paths (assets snapshots list, equity trades list). On the happy path behavior is identical (empty data still → `[]`). The only change is that a genuine DB error now surfaces as `AppError` (caught by the existing error boundaries) instead of a silent empty list — strictly more correct.
- **Reversibility:** single `git revert`. No migration, env, or state.
- **Backout plan:** revert the impl commit.

## Open questions

- [x] Q: Should the list readers throw or keep degrading to `[]`? — Owner: Clarence — A: throw, to match the 3 existing readers and stop masking RLS/connection failures as empty dashboards.
