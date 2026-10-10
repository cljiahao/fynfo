---
id: '093'
area: audit
status: shipped
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/22
created: 2026-10-10
author: Codex
constitution_satisfies:
  - '§2.1'
  - '§2.3'
  - '§3.2'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
---

# Discard pre-write reads before refreshing saved records

## Owner-authorized scope and evidence

Clarence's ongoing roadmap/audit and2026-10-10 parallel-worktree instructions authorize this ordinary remediation under§7.4. Root selected the independently observed stale-read race before speculative dashboard transport work. No dependency, schema/migration, crypto, protected file, provider setting or new feature is included. Only tracked synthetic-fixture source and generated records are used; no real env/secret/account/session/financial data access.

An external087 experiment with installed QueryClient/QueryObserver5.97.0 proved: an active initial read with no cached data remains the same pending read after default invalidateQueries. Its pre-mutation result then becomes successful/current after a confirmed write. Exactly one query invocation persists through invalidation. Explicit cancelQueries discards that late result. Clear discards removed-query late completion; retained hydration replay remains a separate unselected architecture issue. Evidence is visualroot/087-bounded-lab/lifecycle.mjs/json and RESULTS.md, not a claim of actual production disclosure.

## Inventory and coherent batch before edits

Twenty affected plain-invalidation mutations: snapshot save/delete2; salary save/delete2; planner save1; trade create/update/delete3; dividend create/bulk-create/update/delete4; profile save1; tax-relief save1; household create/unlock/accept3 and goal create/contribute/delete3. These actions use the same pending-read invalidation contract. Household invite creation does not invalidate/read cache and is excluded. Expense upsert/delete/settlement already cancel before optimistic patches; their authoritative cache, concurrency rollback and people-suggestion invalidation remain untouched.

Affected paths: src/features/assets/hooks/use-snapshots.ts and use-planner-settings.ts; src/features/salary/hooks/use-salary.ts and use-tax-reliefs.ts; src/features/equity/hooks/use-equity.ts and use-dividends.ts; src/features/profile/hooks/use-profile.ts; src/features/household/hooks/use-household.ts; new src/lib/query-refresh.ts; new test/features/query-refresh.test.tsx; this audit and root-owned README clarification. No server action, RLS, existing query key, validation or encryption contract changes.

Use one small cancel-then-invalidate utility with the actual query prefix, called only after a confirmed mutation succeeds. Cancellation discards in-flight pre-write reads before a new read may publish. Existing background callbacks remain fire-and-forget; existing goals callbacks that return invalidation remain awaited. The helper returns its refresh promise to preserve that choice, rather than introducing a coordinator, global cache or delaying every save until histories refetch. Prefixes cover history/detail queries and future structured subkeys. Household operations refresh both existing affected prefixes. Do not seed empty/optimistic values into these non-optimistic caches. A failed mutation must not cancel a valid read.

## Acceptance, second review and rollback

Actual QueryClientProvider/renderHook tests must fail merged baseline and pass remediation for all20 real mutation hooks: resolve confirmed write during an initial pending read, then resolve stale pre-write response and prove it cannot become success/current data; a new post-write read must start and publish the new result. Cover multi-prefix household invalidation, details/prefix isolation, failed writes, refetch failure, cleared-query generations and awaited versus background completion contracts. Retain existing optimistic-expense tests without changes. Full five gates run only in the isolated fixture, every aggregate metric above80% and existing stricter floors unchanged; independent source review follows. README and concise comments document only the durable contract. Rollback is a scoped code revert, no data reversal.

## Guidance and remaining investigation

This batch changes cache integrity, not UI appearance, so Impeccable adds no new interface work. Existing project next-verify specifies the five gates; no skill/harness edits. [TanStack query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) and [QueryClient methods](https://tanstack.com/query/latest/docs/reference/QueryClient) inform the promise/cancellation contract; installed query-core source and the real-query experiment establish this version's behavior.

Bounded overview/exact-review queries remain unselected.087 local measurements reduce decryption work but can add client serialization/DB pages for ordinary histories; initial SSR still waits for its slowest dataset. No latency improvement or comprehensive authenticated-browser coverage is claimed by093.

## Verification

Implemented the eight scoped hook changes and one cancel-then-invalidate utility. The actual-hook baseline ran40 tests: all20 stale-pending-read regressions failed, while all20 failed-write preservation cases passed. Updated44 hook tests plus seven unchanged optimistic-expense regressions passed. Tests additionally prove snapshot/salary detail-prefix refresh, both household prefixes, failed refresh retaining an error, actual unmount+clear teardown, unrelated prefix isolation and consecutive confirmed saves discarding earlier refreshes. An initial teardown test incorrectly kept financial hooks mounted after clear; it was corrected to perform the actual VaultGate unmount contract, with no product change required.

Final pnpm check, pnpm test:ci and pnpm build passed:121 test files/991 tests; lines93.39%, statements93.08%, functions90.66%, branches88.23%. All existing stricter floors remain unchanged. Only tracked merged source plus the scoped helper/test existed in the fixture src/test inventory. Evidence is093-red-baseline.log,093-focused.log,093-typecheck.log and093-gates.log under the external visualization root. Inline build configuration uses a loopback Supabase placeholder; no provider/account traffic is part of verification.

Client cancellation discards late replies; it cannot abort an already-dispatched Server Function. Previously successful cache data follows the existing background-refresh display policy. Atomic parent/child read coherence, retained hydration replay and cheap people-suggestion invalidation are outside this batch; optimistic expense contracts remain unchanged. No performance or exhaustive freshness/security claim is made.

Root's independent second review found no scoped blocker: cancellation is awaited before invalidation; all twenty callers preserve their existing prefixes and background/awaited contracts; failed-write, actual-hook and unmount/clear regressions cover the observed race. README now records the durable pending-read/background-refresh contract and unchanged optimistic-expense rollback. Inline comments retain only the helper's non-obvious cancellation rationale. Source is frozen for normal unchanged-hook commit/push and root-owned PR/green-CI delivery. Do not mark shipped before merge.
