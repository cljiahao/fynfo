---
id: '087'
area: audit
status: draft
created: 2026-10-10
author: Codex
constitution_satisfies:
  - '§2.1'
  - '§2.3'
  - '§2.4'
  - '§4.2'
  - '§4.5'
  - '§7.4'
  - '§8.2'
---

# Dashboard fetching remediation contract review

## Browser evidence recording batch — 2026-10-10

Under Clarence's continuing audit/roadmap direction, record the completed public
synthetic browser experiment in this spec and
`docs/audit/2026-10-10-dashboard-browser-evidence.md`. This batch changes ordinary
documentation only: no executable files, dependency, migration, crypto protocol,
protected configuration or architecture selection. Acceptance is scoped formatting,
diff review and independent comparison with the saved browser traces. Rollback is
a documentation revert; existing historical proposals and approvals remain intact.

The browser experiment now proves serial client Server Function execution,
parallel public GET controls and pending RSC first-section disclosure for the
installed stack. It also proves deliberately retained payload replay after cache
clear, synthetic identity switch and lock/remount. These are public fixture
observations, not a production gain or an account-data leak finding. Exact methods,
five-run medians, successful failed-only recovery and cache/in-flight/navigation
qualifications are in the evidence record. The owned local server was stopped and
the temporary test tab closed. A separate nested-promise Server Function experiment
is being prepared to test partial readiness without adding a financial HTTP route;
its result is unknown and no product implementation is selected.

## Scope

This is a proposal under Clarence's existing roadmap/audit authorization, prepared in the assigned parallel worktree after baseline 085/transport 086. No application change is implemented. No dependency, schema, crypto protocol, protected file, authorization cache or cross-request cache is proposed. Root reviews the contract and measured alternatives before selecting ordinary remediation; unresolved research is not an invented owner approval requirement.

## Actual lifecycle and consumers

- VaultGate unmounts the financial subtree while locked. VaultUnlockFlow sets the existing vault cookie, invalidates surviving queries with a six-second wait bound, then reveals the subtree. It does not refresh the server route. Consequently, pending SSR alone does not make post-PIN reads parallel.
- Idle lock and sign-out clear the QueryClient and lock the subtree. Server requests cannot be canceled by the browser's local query cancellation; late cache writes and reused hydration payloads require explicit proof.
- Existing keys are snapshots, salary, planner-settings and expenses; all four history/read hooks are enabled on mount. Providers retain five-minute stale time and disable focus refetch. Overview, planner and monthly review share these keys.
- Snapshot/salary/planner successful writes invalidate their key prefixes. Expense upsert/delete/settlement use optimistic patches and cancellation, retaining the expense cache as authoritative without an expense refetch. Aggregation must never overwrite those patches by publishing unrequested results.
- Profile and trades are additional reads outside the four prefetched datasets. Tax readiness and first-use/investment sections depend on them. Four-dataset batching does not prove the entire dashboard ready.
- Monthly review requires arbitrary months; export and feature pages require complete histories. A smaller overview read must use its own cache key, never replace the shared full-history result.

## Option A: feature-owned pending hydration

Move current four prefetches from the route into a feature-owned Server Component to satisfy §2.4. Start the same guarded reads without awaiting their collective completion. Dehydrate successes plus pending queries using defaultShouldDehydrateQuery(query) || query.state.status === 'pending'. Preserve force-dynamic and the existing cache keys/hooks. Fresh server QueryClient per request; no global client/key/auth cache. Use Next's RSC promise transport rather than custom JSON serialization.

Exact Query 5.97.0 source supports this: query-core/src/hydration.ts dehydrates the pending promise and recreates a retryer with initialPromise, avoiding a duplicate fetch for a new hydrated query. HydrationBoundary.tsx defers existing cache updates until commit and excludes replacement of already pending/fetching queries. Successful idle data is eligible when dehydratedAt is newer. These behaviors need mounted and browser proof; a mocked async page test cannot establish stream ordering.

Do not copy shouldRedactErrors:false blindly from the generic SSR example. The route already declares force-dynamic; default redaction preserves opacity. Test expected failures, Next control-flow exceptions and error/retry timing before choosing a setting. Locked prefetch promises that reject after dehydration can seed failed client reads after PIN unlock and introduce retry delay; do not serialize such promises as successful preparation.

A fixed synthetic query-core experiment (external 087-hydration-lifecycle.mjs) found: hydrate a pending promise, clear the client, complete the old promise => query remains absent. Rehydrate the same retained payload afterward => pre-lock synthetic data returns. This is library lifecycle behavior, not an established product disclosure. Do not rely on cancellation alone. A stream implementation must demonstrate that stale payloads cannot rehydrate after lock, sign-out, identity change or context replacement, including delayed RSC completion. If this needs a larger lifecycle change, keep the streaming work separate.

Pending hydration addresses initially unlocked SSR visits. It does not by itself fix post-PIN client serialization, because revealWhenReady does not initiate a new server render. router.refresh returns no completion promise; casually adding it can race existing client reads and duplicate requests. Preserve current unlocking/error behavior until a measured transition contract exists.

## Option B: one overview-local aggregate Server Function

A feature-owned authenticated getOverviewData may initiate the four existing guarded readers with Promise.allSettled inside one request. The outer action verifies identity then vault before launching readers; existing reader guards remain, without speculative memoization. Each dataset returns success with its existing typed data or an opaque unavailable outcome. Global auth/vault failure rejects without DB access; a dataset DB failure does not silently become an empty history or null profile. Plaintext exists only at the existing authorized process/browser boundaries.

A coordinator must be scoped to the mounted overview and QueryClient lifetime, never global. Existing per-feature useQuery calls retain keys, retry policy and result/error state; query functions consume AbortSignal. They join a pending batch and return only their own outcome. Do not call setQueryData for all aggregate results or add a second authoritative overview cache. Outside the overview provider, existing action-backed hooks remain unchanged. Mutation invalidation and optimistic expense patches continue using their original keys and cancellation semantics.

Only currently pending work may be shared. A second read of the same dataset after cancellation, invalidation or retry must start a fresh cohort, never reuse a pre-mutation promise. Each dataset may join a cohort once. An old cohort's cleanup cannot clear a newer cohort. Removed/canceled query objects and obsolete provider generations cannot publish after clear/unmount. Retrying one failed query must not accidentally republish other datasets. Strict Mode cancellation may add a bounded development request; production initial reads need explicit no-double-fetch proof.

The response still waits for the slowest requested dataset. Fast asset/salary cards can regress while a slow expense history runs. The equal-delay transport proof 086 demonstrates queuing, not suitability for the user's first-row complaint. This option is not selected without asymmetric first-visible-section and all-ready measurements.

## Option C: bounded latest-two overview read

Investigate a dedicated owner/vault-guarded latest-two snapshot action. Fetch two plaintext parent months in descending order, then fully page all children of those two parent IDs under the existing owner filter, decrypt and return ascending months. Keep full-history getSnapshots unchanged. A structured snapshots-prefix subkey such as ['snapshots', { scope: 'summary', limit: 2 }] preserves existing mutation prefix invalidation and avoids collisions with string edit IDs. Existing useSnapshot(editId) receives arbitrary query-string edit values, so a string 'summary' subkey is unsafe. Shipped main does not validate that read month; unmerged spec083 adds server validation, which still would not prevent the client cache-key collision. Never seed ['snapshots'] with truncated data.

The first row and planner only need these latest records. Monthly review/export continue full histories. An already successful fresh full-history cache could supply initial summary data with its original dataUpdatedAt, avoiding duplicate initial reads; empty/stale/error caches must not masquerade as fresh summary data. This reduces read work but does not remove Next client queuing or the existing SSR await-all gate. Measure post-PIN and initially unlocked paths separately before selecting it. A dedicated query is justified only by demonstrated read/latency savings, not abstract preference for more hooks.

## Candidate paths, acceptance and rollback

Potential scope after contract selection: features/overview Server Component/action/coordinator and public barrel; dashboard overview route/component composition; existing assets/salary/expenses/planner query hooks only where chosen transport requires; targeted tests and README. No equity/price/currency source or active batch084 paths are included. Concrete chosen paths must be recorded before editing. Client components remain limited to existing query/state interactivity; no UI controls or speculative abstractions are required.

Acceptance must cover:

1. Known asymmetric delays in an actual local Next production browser fixture: fast assets/slow expenses and slow assets/fast salary; first visible asset row, first salary row, all-ready time and request counts. Compare existing behavior with each candidate, using warmups and alternating runs. Do not hide a first-row regression inside total-ready improvements.
2. Initial unlocked hydration, stale idle cache, existing in-flight queries, client back navigation and cold/warm mounts. No duplicate feature request for successful new hydrated data; no replacement of newer data by an older stream.
3. Locked server render, successful unlock, failed unlock, idle lock, sign-out failure/success, clear during a pending response, remount and identity/context changes. No stale plaintext query or hydration replay after teardown.
4. Independent snapshot/salary/settings/expense failures and retries. Keep pending skeletons and visible errors; empty successful datasets retain truthful zero states. No DB details cross the boundary.
5. Snapshot save/delete and salary/settings mutation invalidation while an aggregate/stream is pending; expense optimistic upsert/delete/settle and rollback remain intact. Complete full-history/export coverage persists.
6. Identity-before-vault-before-DB regressions for every new server entry; existing stricter coverage floors and all five gates; measured synthetic/browser evidence and second review. Rollback is a scoped code revert, with no migration or data reversal.

## Evidence and unresolved decisions

[Next.js Server Function dispatch](https://nextjs.org/docs/app/getting-started/mutating-data), [TanStack advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [TanStack QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient) and installed Query 5.97.0 hydration source inform this proposal. Baselines 085/086 do not prove a production gain. The next independent experiment is asymmetric local RSC pending-hydration transport with fixed data and failures, plus lifecycle replay tests. No option is marked approved, implemented or shipped here.

## Independent bounded-window review

MonthlyReview uses only the selected calendar month and its immediately preceding
month. A separate exact-window structured key could preserve arbitrary review
months without mounting full history on the dashboard. Keep full history for
assets, forms and export. This must not assume the latest two snapshots correspond
to the selected review months. Two independent bounded reads could reduce the
1200-month stress fixture from 68 DB pages to roughly 4, but increase the 12-month
fixture from 2 pages to 4 and add client serialization overhead. Fresh/error cache
seeding and any shared-window reuse require proof. This is an unselected
alternative, not a performance claim or approved implementation.
