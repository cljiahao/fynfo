---
id: 169
slug: expenses-read-perf
area: fix
status: approved
author: Claude
created: 2026-11-03
approved: 2026-11-03
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
   - Also capture the same per-stage timing on prod (logger output in Vercel logs, durations and row counts only), because network latency between Vercel and Supabase cannot be reproduced locally.
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
- [ ] Q: Do the Vercel function region and the Supabase project region match? Back-to-back 500-row pages each pay a cross-region round trip that a seeded local DB will not show. — Owner: Clarence — A:

## Audit: phase 1 measurements

Instrumentation: `readExpenses` emits one `logger.info` per call (`event: 'expenses.read.timing'`) with `ranged`, `contextMs`, `recordsMs`, `recordRows`, `recordPages`, `splitsMs`, `splitRows`, `splitPages`, `decryptMs`, `totalMs`. Durations and counts only. It logs from a `finally`, so a read that outlives the 15 s `withDeadline` still logs when it settles; stages it never reached are absent. Page counts are derived as `ceil(rows / 500)` because `readAllRows` does not report them.

Local benchmark: `node scripts/bench-expenses-read.mjs [scales]` (Docker + `pnpm db:start`). It seeds a throwaway local user, times the records and splits paged reads through supabase-js under RLS, and saves `EXPLAIN (ANALYZE, BUFFERS)` for one page of each to `scripts/.bench-out/`.

Local results (Docker Desktop, local Supabase, tables `ANALYZE`d after seeding, ~40% of records shared with 1-2 splits, two runs per scale; reads go through supabase-js as the seeded user so RLS applies, with `count: 'exact'` on every page as in `readAllRows`). Per-page ms lists are in the order the pages were read.

| Source              | Records (pages) | Splits (pages) | Records ms total (per page) | Splits ms total (per page) | Decrypt ms   | Sequential total ms        |
| ------------------- | --------------- | -------------- | --------------------------- | -------------------------- | ------------ | -------------------------- |
| Local 2,500, run 1  | 2,500 (5)       | 1,419 (3)      | 168 (46,27,33,33,29)        | 187 (65,61,61)             | not measured | 355                        |
| Local 2,500, run 2  | 2,500 (5)       | 1,508 (4)      | 140 (35,32,27,16,30)        | 473 (96,151,124,101)       | not measured | 613                        |
| Local 10,000, run 1 | 10,000 (20)     | 6,034 (13)     | 810 (about 26-81 each)      | 2,747 (174-254 each)       | not measured | 3,557                      |
| Local 10,000, run 2 | 10,000 (20)     | 5,920 (12)     | 597 (16-41 each)            | 2,269 (147-216 each)       | not measured | 2,866                      |
| Prod (Vercel logs)  | 4,410 (9)       | 703 (2)        | 10,572 (about 1,175 avg)    | 2,088 (about 1,044 avg)    | 232          | 13,718 (incl. 827 context) |

Reading: at 10,000 records the splits read costs about 4x the records read (about 2.3-2.7 s vs 0.6-0.8 s) and each splits page costs about 150-250 ms against about 30 ms for a records page. Local figures are well under the 15 s deadline, so the prod overrun is not explained by local query cost alone; the remaining candidates are Vercel-to-Supabase latency multiplied by the page count (sequential round trips) and a larger prod dataset. The count-exact overhead per page was not separated (the script does not time a no-count variant); this is open. Decrypt time is only measured by the instrumentation in `readExpenses`, not by the script.

Prod reading: the prod capture (2026-11-03, unranged `getExpenses`, vault unlocked) has fewer rows than the local 10,000 run yet is about 4-5x slower. Each page costs about 1.0-1.2 s on prod against 16-250 ms locally, so per-request latency (the Vercel-to-Supabase round trip plus per-page `count: 'exact'`) multiplied by sequential pages dominates, not row volume or decrypt (232 ms). Records, not splits, are the larger stage on prod (9 pages vs 2). A single read at 13.7 s leaves little headroom under the 15 s deadline, matching the observed 15.3 s overrun. Two earlier log lines at 15:42:52-53 with no stage fields (totalMs 840 and 945) were reads that failed in `requireActionContext` while the vault was locked, so they are not measurements.

Caveat: a first pair of runs on unanalyzed freshly seeded tables showed the planner estimating one row per table, and one run of splits reads took 44 s at 10,000 (per page 0.5 s growing to 6 s) while table bloat from earlier delete cycles was present. After `VACUUM FULL ANALYZE` and an `ANALYZE` step in the script the results above were stable. Prod tables are autovacuumed, but stale statistics or bloat on prod `expense_splits` / `expense_records` is a cheap hypothesis to check.

EXPLAIN (ANALYZE, BUFFERS), page 1 of 500, as the seeded user, RLS applied (`scripts/.bench-out/`):

| Query                  | Scale  | Plan                                                                                                                                                                                                                                                           | Execution ms | Buffers (hit) |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------- |
| records page           | 2,500  | Limit > Incremental Sort > Index Scan Backward `idx_expense_records_date` with Filter `user_id` (501 rows read, 1 removed)                                                                                                                                     | 1.5          | 2,382         |
| records page           | 10,000 | same plan                                                                                                                                                                                                                                                      | 0.9          | 724           |
| splits page (`!inner`) | 2,500  | Limit > Incremental Sort > Merge Join: Index Scan `idx_expense_splits_expense` carrying the RLS `ANY (hashed SubPlan 2)` filter, joined to Sort > Seq Scan `expense_records p`; SubPlan 2 is a Seq Scan on `expense_records` returning all 2,500 rows (3.5 ms) | 8.2          | 2,344         |
| splits page (`!inner`) | 10,000 | same shape with Index Scan on `expense_records_pkey` for `p`; SubPlan 2 is an Index Scan `idx_expense_records_user` returning 10,000 rows (6.4 ms)                                                                                                             | 11.6         | 2,932         |

Findings: the records page uses `idx_expense_records_date` and filters on `user_id`, so the per-user index is not used for ordering. The splits policy runs as a hashed SubPlan that scans all of the user's `expense_records` on every page, in addition to the explicit `!inner` join that scans them again. Page 1 is cheap inside Postgres (under 12 ms), yet the REST pages cost 150-250 ms; the gap is the `count: 'exact'` query, which counts the full join on each page, deeper OFFSET pages, and PostgREST/network overhead. Which of these dominates is not yet separated. The policies' per-row `auth.uid()` appears here as `COALESCE(NULLIF(current_setting(...)))` evaluated once as an InitPlan-style One-Time Filter, so it is not obviously per-row in these plans.

### Phase 2: parallel page reads

The expenses read now uses an opt-in `readAllRows(..., { concurrency })` mode (`PARALLEL_READ_CONCURRENCY` = 4). It reads page 1 alone to learn the exact count, then fetches the remaining pages with bounded concurrency, assembles rows in offset order, and keeps the same count-consistency guard (every page must repeat the first count; non-final pages must be exactly 500 rows and the final page exactly the remainder). Default callers are unchanged. In `readExpensesTimed` the unranged records and splits reads now run concurrently; the ranged path still needs record ids first. Expected round trips for the prod capture: records 1 + ceil(8/4) = 3 waves instead of 9 serial pages, and splits (2 pages) overlap with them, so roughly 3 round trips of about 1.1 s plus context instead of about 13.7 s. The `expenses.read.timing` fields are unchanged; `recordsMs` and `splitsMs` now overlap, so `totalMs` is no longer their sum. Prod re-measure (2026-11-03 17:57 SGT, deploy fcc1c09): two `getExpenses` reads ran concurrently, one from `/dashboard` and one from `/dashboard/expenses`, each unranged with 4,410 records (9 pages) and 703 splits (2 pages).

| Source (phase 2, prod) | context ms | recordsMs | splitsMs | decrypt ms | totalMs |
| ---------------------- | ---------- | --------- | -------- | ---------- | ------- |
| Baseline (phase 1)     | 827        | 10,572    | 2,088    | 232        | 13,718  |
| `/dashboard/expenses`  | 828        | 4,443     | 1,642    | 138        | 5,409   |
| `/dashboard`           | 858        | 4,517     | 2,605    | 231        | 5,606   |

`recordsMs` and `splitsMs` overlap, so they do not sum to `totalMs`. Records still take about 4.4 s (page 1 plus two waves of 4 at about 1.1-1.5 s per round trip). The overview and expenses pages each fire their own full read on the same load.

Conclusion: `totalMs` fell about 2.5x (13.7 s to about 5.5 s), well under the 15 s `EXPENSE_READ_TIMEOUT_MS` deadline.
