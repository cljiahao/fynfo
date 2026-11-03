---
id: 169
slug: expenses-read-perf
area: fix
status: draft
author: Claude
created: 2026-11-03
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  ['§2.1', '§2.2', '§2.3', '§4.1', '§4.2', '§5.2', '§5.4', '§6.3']
constitution_overrides: []
---

# Spec 169: Measure and fix the slow expenses read

## Problem

On prod, `getExpenses` exceeds its 15 s deadline and returns 500 (body `1:E{"digest":"2654945119"}`, 15304 ms). On a hard load `/dashboard/expenses` shows a textless skeleton for about 20 s while React Query retries, then renders. Successful responses are about 806 KB. Cause is unmeasured; the code below only identifies candidates.

Evidence (verified in code):

- `src/features/expenses/actions/expense-actions.ts:39-40` `getExpenses` is `withDeadline(readExpenses(), EXPENSE_READ_TIMEOUT_MS)`; `src/features/expenses/constants.ts:129` sets 15_000. `src/lib/with-deadline.ts` rejects the race but does not cancel the query.
- `expense-actions.ts:56-71` reads all `expense_records` through `readAllRows` with `count: 'exact'`, then `:78-93` sequentially reads all `expense_splits` the same way, with `parent:expense_records!inner(user_id)` and `.eq('parent.user_id', userId)`. In the unranged path the splits read is not limited to `split_type = 'shared'` records (the ranged path does this at `:79-83` via `readSplitsFor`). `getDistinctPeople` (`:246-256`) repeats the join pattern.
- `src/lib/read-all-rows.ts:12-45`: page size 500 (`:3`), sequential do/while, every page requires `count` and checks it is consistent. Used by 9 files (about 17 call sites), so any change has repo-wide reach.
- `supabase/migrations/20260411150000_init.sql:60-61,73`: indexes on `expense_records(user_id)`, `(date)` and `expense_splits(expense_id)`. Policies at `:148` (`auth.uid() = user_id`) and `:153-155` (EXISTS subquery on `expense_records` using `auth.uid()`) call `auth.uid()` per row instead of `(select auth.uid())`. No later migration redefines these policies or indexes.
- `src/features/expenses/hooks/use-expenses.ts:154-161` `useExpenses` sets no `retry`, so React Query's default of 3 retries with backoff applies. `src/app/dashboard/expenses/page.tsx:17` renders `ExpensesSkeleton`, which has no text.

## Constitution check

- Satisfies: `§2.1` (payloads stay encrypted; decrypt path unchanged), `§2.2`/`§2.3` (`requireActionContext` stays first in every action), `§4.1` (all five gates), `§4.2` (tests for each read-path change), `§5.2` (RLS stays on; any policy rewrite keeps semantics), `§5.4` (no query on encrypted columns), `§6.3` (any migration is forward-only and non-destructive).
- `§4.5` (200KB JS budget) is not touched; no new dependency.
- Overrides: none. No `HARD` rule is changed.

## Solution shape

Phased. Phase 2 and 3 items are chosen only after phase 1 numbers exist.

1. Measure first.
   - Add per-stage timing in `readExpenses` using the existing pino `logger` (`src/lib/logger.ts`), not `console.log`: context/auth, each records page, each splits page, decrypt. Log durations and row counts only, never row contents. Keep it behind a flag or remove it before merge; decide in review.
   - Dataset: a local Supabase seeded with synthetic encrypted rows sized to prod scale (script under `scripts/` or a Vitest bench; no real user data). Prod row counts come from Clarence's own count query (see Open questions).
   - Separately time the same queries via SQL `EXPLAIN (ANALYZE, BUFFERS)` on the seeded DB to isolate RLS and join cost from network and `count: 'exact'` cost.
   - Record the numbers in an audit note appended to this spec before any fix is chosen.
2. Candidate fixes, each kept only if phase 1 shows it matters.
   - Run the records and splits reads concurrently (`Promise.all`); the splits query does not depend on the records result.
   - Splits: remove the `!inner` join and `parent.user_id` filter (RLS on `expense_splits` already scopes to the owner) or restrict to shared records, matching the ranged path.
   - `readAllRows`: avoid `count: 'exact'` on every page (count once on page 1, or terminate on a short page) while keeping the consistency guarantee. Prefer an opt-in option or sibling helper so the other callers are unchanged.
   - Migration (needs separate owner approval, see Risk): recreate the two policies with `(select auth.uid())` and add a composite index such as `expense_records(user_id, date desc, id)` if EXPLAIN shows a sort or filter cost. Clarence applies prod SQL himself.
   - Payload: if encrypted `item`/`info` dominate the 806 KB, evaluate lazy `info` or narrower selects. Only if measured; may need its own spec.
3. UX.
   - Add text to the loading state in `ExpensesSkeleton` or a "still loading" message after a few seconds.
   - Set `retry` on `useExpenses` so a deadline timeout is not retried three times blindly (for example one retry, or none for the timeout error), and surface the existing error state sooner.

Encryption-touching paths: only the decrypt loop at `expense-actions.ts:95-120` is near the change; it is not modified beyond timing.

## Out of scope

- Changing encryption, DEK handling or the vault.
- Pagination or virtualised lists in the UI, or a new summary table.
- Changing other features' read paths beyond the shared `readAllRows` option.
- Replacing React Query or the overview read transport.

## Acceptance

- [ ] Before and after per-stage timings recorded in this spec or an audit note, same dataset.
- [ ] `getExpenses` p50 on a prod-scale dataset under 3 s and p95 under 6 s (proposed; see Open questions).
- [ ] Vitest (node env) covers every changed read path: concurrent reads, splits scoping, and `readAllRows` consistency checks (count mismatch, short page, over-count still throw `DB_ERROR`), plus unchanged default behaviour for existing callers.
- [ ] Error responses stay opaque; no Supabase text, table or constraint names in responses.
- [ ] `requireActionContext()` is still the first call in each touched action.
- [ ] Hard load of `/dashboard/expenses` shows readable text while loading and a timeout is not retried three times.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green.
- [ ] If a migration is included: reviewed and approved separately, applied by Clarence, EXPLAIN before/after recorded.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: `readAllRows` has about 17 call sites in 9 files; an incorrect change can break reads or silently truncate data across features. Hence opt-in. A policy rewrite touches every expense query for every user.
- **Consistency**: concurrent record and split reads can observe a write between them; a split may reference a record not in the result (or the reverse). Readers already tolerate a missing group via `?? []`; confirm in tests. Dropping `count: 'exact'` weakens the truncation check unless replaced.
- **Reversibility**: code changes are a single git revert. The migration is forward-only (`§6.3`); policy and index changes are non-destructive.
- **Backout plan**: revert the code PR. For the migration, ship rollback SQL in the impl PR that restores the two original policies exactly as in `20260411150000_init.sql:148,153-155` and removes the new index.

## Open questions

- [ ] Q: Target latency for `getExpenses` (proposed p50 < 3 s, p95 < 6 s)? — Owner: Clarence — A:
- [ ] Q: Keep the 15 s deadline, raise it, or lower it once the read is fast? — Owner: Clarence — A:
- [ ] Q: Prod row counts for `expense_records` and `expense_splits` (Clarence runs the count query himself)? — Owner: Clarence — A:
- [ ] Q: Is the per-stage timing kept permanently or removed after phase 1? — Owner: Clarence — A:
- [ ] Q: Is the migration part of this spec or split into its own spec after phase 1? — Owner: Clarence — A:
