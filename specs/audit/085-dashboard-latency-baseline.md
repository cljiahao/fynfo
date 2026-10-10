---
id: '085'
area: audit
status: shipped
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/16
created: 2026-10-10
author: Codex
constitution_satisfies:
  - '§2.1'
  - '§2.3'
  - '§4.2'
  - '§7.4'
  - '§8.2'
---

# Dashboard latency and synthetic workflow baseline

## Owner authorization and scope

Clarence requested parallel worktrees on 2026-10-10 while retaining sequential green-CI delivery. This owner-authorized investigation under §7.4 records evidence before ordinary remediation. It does not authorize dependencies, migrations, protected files, crypto changes or deployment. Batch C owns investment/quote/currency paths; this batch does not edit them.

## Findings before changes

- The overview page already starts four prefetched datasets concurrently. It awaits their combined completion before returning a hydration boundary; the slowest complete history therefore gates initial overview rendering.
- Snapshot histories page parents and children separately and decrypt the complete history. Summary rendering uses only two months, but monthly review consumes arbitrary months and the planner uses the latest snapshot. Replacing the shared history cache with a two-month cache would violate consumers.
- Ready salary/asset rows, pending skeletons instead of false zeros, retry errors, hydration deduplication and monthly-review inputs already have meaningful jsdom coverage in overview-workflows.test.tsx. These shipped fixes must not be repeated.
- Existing browser evidence is a synthetic component preview with stubbed actions/router. It does not prove Next server-action transport, Supabase authentication, vault cookies or production latency.

## Proposed measurement paths

- test/benchmarks/dashboard-history.bench.ts: opt-in Vitest benchmark, existing dependencies only. Real AES-GCM decrypt calls on generated 12/120/1200-month fixtures, six entries per month, API cap 125. No auth/vault cookies, network, plaintext real records or process environment dump. Report min/mean/p99 through Vitest's JSON benchmark reporter, outside tracked files.
- test/features/assets/dashboard-prefetch.test.tsx: deterministic deferred-action test proves eager concurrent start and slowest-dataset gating, with no wall-clock latency threshold. Existing workflow regressions cover truthful pending/error states.

## Acceptance and reversibility

Run only inside a separately prepared synthetic tracked-file fixture. Confirm full output cardinality and paging counts before each timed run; fixture generation/encryption is outside the measured operation. Benchmark timings include stub query orchestration and real local decryption, not network or production unlock-to-ready latency. Run five standard gates before executable-test delivery. Second review checks measurement boundaries, consumer contracts and absence of sensitive reads. Revert test additions only; application behavior remains unchanged.

## Research and remaining decisions

[Next.js fetching guidance](https://nextjs.org/docs/app/getting-started/fetching-data) supports parallel starts and Suspense boundaries for independent loading. [TanStack advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) describes hydration/streaming tradeoffs. Neither source proves a speed gain for this app. A bounded overview dataset or separate streamed summaries requires an explicit cache/consumer contract and before/after browser measurement; no speculative optimization is implemented here.

Broader authenticated synthetic browser coverage needs a verified local fake identity/vault/backend boundary. No browser dependency or CI change is authorized in this batch. UI changes would use Impeccable; this measurement-only batch changes no interface.

## Initial results and second review

An initial isolated run passed the deterministic prefetch test. Real-decryption benchmark means were 1.36 ms for 12 months/72 entries, 12.08 ms for 120 months/720 entries and 124.20 ms for 1200 months/7200 entries, with 2/7/68 stub query pages respectively. This short 5-sample stress run is preliminary, and later measurements must report repeatability. Fixtures intentionally model larger-than-usual histories to reveal scaling; their figures do not estimate typical personal usage or production network latency.

Second source review retained parallel prefetching, rejected truncating shared histories, and added per-entry decrypted amount/account checks to benchmark completeness assertions. Increased minimum samples to 20 and warmup to 100 ms; no brittle elapsed-time assertion. Default test:ci excludes .bench.ts, so the benchmark runs explicitly and does not slow regular coverage gates. No real financial data, auth session or environment file is needed.

Next proposal: measure a local browser first-paint/readiness boundary with a documented synthetic backend, then compare complete-history prefetch against independently streamed feature boundaries. Preserve single owner scope, request lifetime and cache invalidation; keep review/export history complete. The existing page's prefetching is inconsistent with constitution §2.4's thin-page rule, but this measurement batch does not expand into architectural remediation without a measured alternative. Browser batch F remains open.

## Reviewed verification

The independently installed synthetic fixture passed formatting, lint, typecheck, coverage and optimized production build: 116 files / 890 tests; lines 92.92%, statements 92.66%, functions 90.17%, branches 87.69%. Existing stricter floors remain unchanged. Benchmark completeness checks pass with 2 / 7 / 68 stub query pages respectively.

The revised run measured means of 1.90 / 15.80 / 200.11 ms and p99 of 4.44 / 22.98 / 232.59 ms for 12 / 120 / 1200 months. Sample counts were 264 / 32 / 20. Timed work includes fresh fake-query builder creation, full history read/grouping, real local decryption and all completeness assertions. Encryption/fixture generation occur before measurement. These are not pure AES costs, network latency or first-paint timings. The host also ran other authorized verification; no before/after optimization claim is justified from these values. Reports remain outside source in 085-dashboard-benchmark-final.json and 085-gates.log.

Official [Next.js Server Function guidance](https://nextjs.org/docs/app/getting-started/mutating-data) states that client dispatch currently awaits Server Functions one at a time. Installed Next.js 16.3.8 corroborates this in next/dist/client/components/app-router-instance.js: runRemainingActions advances after a settled head (lines 50–61), while non-navigation calls enqueue behind the pending action (lines 164–168). Server-side prefetch is parallel, but independent client hooks calling server functions after vault unlock cannot claim parallel transport from Promise.all in mocked tests. A separate loopback transport lab protocol is drafted as spec086 before any production fetching change.

README/comments require no product update for this measurement-only batch. The new benchmark and test have no explanatory narration or suppressions. Proposed reproducible command inside the synthetic fixture: node node_modules/vitest/vitest.mjs bench test/benchmarks/dashboard-history.bench.ts --run --outputJson ../085-dashboard-benchmark.json. No new dependency, migration, protected file or product behavior changed. PR16 merged on 2026-10-10 after all required checks passed on exact head 3a3d635. This ships measurement tooling and evidence, not a production latency optimization.

## 119 compiler-boundary correction to earlier unit evidence

The earlier parallel-prefetch statement described intended ordinary JavaScript behavior. The actual Next.js 16.3.8 webpack RSC build transformed query-key exports from client-hook modules into client-reference functions. Installed Query 5.97 hashes those functions to the same undefined key, so the original page prefetched only the first snapshot source. Plain-import tests did not establish RSC key validity. Preserve this historical record and its measured artifacts; do not rewrite original approvals or infer production latency/authentication from the synthetic finding.

119 records neutral unchanged arrays and a feature-owned await-all Server Component; initial SSR still waits for its slowest source, and post-unlock behavior remains the existing 108 cohort. Actual corrected compiler proof maps all four keys to arrays, while unused hook references remain elsewhere in the server graph. Synthetic hydration/counter proof and final gates are recorded in the 119 audit; broader pending-query streaming remains an unselected proposal.
