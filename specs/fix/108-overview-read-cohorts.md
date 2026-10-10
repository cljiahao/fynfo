---
id: 108
slug: overview-read-cohorts
area: fix
status: draft
author: Codex
created: 2026-10-10
approved:
shipped:
impl_pr:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§5.1'
  - '§5.2'
  - '§5.3'
  - '§7.4'
constitution_overrides: []
---

# Audit 108: Overview read cohorts

## Problem and authorization

Clarence authorized the whole-codebase security/maintainability/performance audit and sequential improvements under roadmap 081, explicitly reporting slower first-row dashboard cards. This record scopes an ordinary reversible performance remediation under Constitution §7.4; it does not invent a separately reviewed owner approval or new feature. Root requested this proposal for review before application edits. No dependency, migration, crypto or protected-file edit is included.

External 087 production-webpack browser evidence shows separate client Server Functions serialize the fixed reads, while one action returning independently resolving nested outcomes exposes the fast dataset early. Five-run medians for slow-assets/fast-expenses were 817.0/911.1 ms for separate reads and 818.1/85.0 ms for the bundle; these are synthetic framework timings, not product improvement claims. An ordinary await-all aggregate would regress fast-section readiness.

## Constitution check

Preserve authenticated Server Functions (§2.2), identity then vault before any read (§2.3), ciphertext/decryption contracts (§2.1/§5.1), RLS (§5.2), complete histories and existing keys. Pages receive no new fetching (§2.4); existing await-all SSR behavior is left unchanged in this batch rather than introducing retained pending hydration. New client context/provider is justified by interactive query batching, abort/lifetime state and existing Query hooks (§2.5). Runtime feature dependencies use public barrels; common client context must not runtime-import a feature (§2.6). No new HTTP financial route or auth cache.

## Recorded paths before implementation

- Add `src/lib/overview-read-context.tsx`: feature-independent client context/interface only; runtime imports React, no features/actions or money values.
- Add `src/features/overview/types.ts`, `constants.ts`, `schemas.ts`: five allowlisted dataset names, typed per-source opaque outcomes/promise result map and bounded unique requested-key validation.
- Add `src/features/overview/actions/overview-actions.ts`: guarded streamed subset read.
- Add `src/features/overview/lib/read-cohorts.ts`: generic pending-request coalescing and caller lifetime/abort guards, no Query cache insertion.
- Add `src/features/overview/components/overview-read-provider.tsx` and `index.ts`: overview-only transport adapter/provider public surface.
- Edit `src/app/dashboard/(overview)/dashboard-overview.tsx`: feature provider wrapper around the existing overview component, no arithmetic/layout/query gate changes.
- Edit only read query functions in `src/features/assets/hooks/use-snapshots.ts`, `src/features/assets/hooks/use-planner-settings.ts`, `src/features/salary/hooks/use-salary.ts`, `src/features/expenses/hooks/use-expenses.ts`: optional context transport with Query AbortSignal; existing action fallback outside provider remains.
- Edit `src/features/equity/hooks/use-equity.ts` and `src/features/equity/index.ts`: recorded before the measured correction, add only optional trade query transport and public existing guarded reader export; preserve mutations and full history.
- Edit `src/features/assets/index.ts`, `src/features/salary/index.ts`, `src/features/expenses/index.ts`: expose only existing guarded readers/types needed by the overview action through named public exports. Audit runtime graph and bundle impact; do not introduce server/client cycles.
- Add `test/features/overview/overview-actions.test.ts`, `read-cohorts.test.ts`, `overview-read-provider.test.tsx`: action guard/subset/opaque outcome, cohort and actual consumer/lifetime regressions. Extend existing expense optimistic interaction test only if needed to exercise the actual hook with the provider; name exact additional test path before that edit.
- Edit `test/features/financial-vault-guards.test.ts`: add the new overview action to the existing actual financial guard inventory; mock only identity/key/backend boundaries, not the action wrapper.
- Edit `test/features/assets/overview-workflows.test.tsx`: retain the actual new overview action while providing a synthetic action-context boundary to its existing mocked readers. Six existing cold UI/readiness tests reproduced failures because their original reader mocks did not stub the newly introduced guarded wrapper. These remain UI/readiness proofs, separate from actual authentication/vault guard tests. Complete batch inventory is now 28 files.
- Edit `vitest.config.ts`: after measuring coverage, gate the new overview action and read-cohort lifecycle helper at 95% lines/statements, 100% functions and 90% branches. Existing stricter thresholds remain unchanged; cover meaningful missing paths if necessary. Root reviewed this additional ordinary validation scope before the edit on 2026-10-10. The complete batch inventory is 28 files, including the two integrated 087 evidence documents, existing overview workflow test and the measured equity-hook/barrel correction.
- Edit `README.md` and record `specs/fix/108-overview-read-cohorts.md`: bounded behavior, evidence/results/residuals.
- Integrate root-prepared ordinary evidence documents `specs/audit/087-dashboard-fetching-contract.md` and `docs/audit/2026-10-10-dashboard-browser-evidence.md`, including the independently checked bundle findings above, in this coherent measured-performance batch. No separate executable 087 delivery or architecture approval is implied.

No changes to page.tsx, auth 095 code, shared Query defaults, source read actions/SQL/crypto or protected files. If tests show any of those must change, pause and record the newly justified scope before editing; no silent expansion.

## Solution shape

The new Server Function validates a unique subset of snapshots/salary/planner/expenses/trades (one to five), awaits `requireActionContext()` before launching anything, then invokes existing individually guarded readers only for requested datasets. Guard failures launch zero readers. Each started reader maps success/failure into an opaque typed outcome promise immediately; the returned plain object contains those promises without collective waiting. No raw Supabase/crypto errors or keys in results. Individual readers retain their own identity/vault/RLS checks; this batch deliberately does not memoize authentication or share cross-request context.

Each existing Query hook asks the optional context for its one dataset and passes its actual queryFn AbortSignal. Outside overview it calls its existing reader unchanged. A fresh provider-owned cohort gathers unique pending reads until the next microtask; flush detaches the queue and invokes one action for that exact subset. A same-key request cannot join/reuse an earlier started or queued cohort: flush any existing queued duplicate into its own cohort before queuing the new request. No completed promise cache and no reuse across retry/invalidation/mutation. Warm successful Query data triggers no read, so cohorting must not force extra sources.

Every query awaits only its own outcome. Client promise wrappers consume Query's actual AbortSignal, rejecting aborted/obsolete replies before Query can commit them. Cancellation before flush removes the queued read (empty queue launches no action); post-start cancellation rejects that consumer even though the Server Function/server work may continue. Query owns consumer lifetime: last-observer teardown, Query destruction/clear and 095 invalidate the signal. Removing only the overview observer must not cancel a still-legitimate same-owner observer sharing that Query. No provider-wide cancellation or Query ownership registry/refetch fanout. One source cancellation does not cancel or fail surviving unrelated consumers. No manual setQueryData fanout, no mutation of existing cache shape, no new keys/history truncation.

Expense mutations already cancel expense queries before optimistic row patches and do not reread expenses on successful quick-add/delete/settlement. Preserve those contracts. A late pre-mutation expense outcome cannot overwrite optimistic rows; salary/planner/snapshot invalidation starts a fresh subset cohort. Failed-only retry requests only that dataset, leaving ready cards alone.

Provider construction must behave correctly in React StrictMode setup-cleanup-setup. A targeted actual-query test reproduced a failed surviving nonoverview observer under provider-wide cancellation. Root reviewed installed Query 5.97.0 query.ts removeObserver (consumed signal and last observer cancel with revert), destroy (silent cancellation) and 095 clear semantics, and selected signal-owned cancellation on 2026-10-10 before the correction. Remove the unused coordinator cancel API; prove real AbortSignal boundaries rather than adding a manual ownership registry. Existing SSR cache hydration is unchanged; no new retained promise payload or RSC unlock refresh is introduced.

## Out of scope

New route handlers, bounded-history summary queries, changing full-history readers, coherent cross-table database snapshots, request-level auth caching, new Query retry defaults, auth/crypto/SQL/dependencies, persistent client data, production instrumentation and private account testing. No total-await aggregate, speculative global coordinator, log of amounts, or claim server work can be physically aborted by Query signal.

## Acceptance

- Baseline actual mounted overview cold synthetic workflow demonstrates serial first-row reads; implementation actual Next workflow demonstrates independent fast-section readiness and no duplicate source/outer calls under identical asymmetric delays. Record build bundler/version/sample size/origin/cache/startup conditions; no product gain claim from the public 087 fixture alone.
- Action tests prove input validation, no reader launch on auth/vault failure, exact subset launch once, nested fast outcome independent of slow source, per-source opaque failure and unchanged original guarded reader behavior.
- Cohort tests prove unique same-microtask coalescing, duplicate-key fresh cohort, later retry/invalidation fresh subset, before-start abort/no-action, post-start abort/late outcome inert, survivor unaffected, transport rejection, signal-owned teardown, no cache fanout and listener cleanup.
- Actual five hooks/provider tests prove warm cache no new source reads; overview-only scope; nonoverview original actions; full histories/cache keys; independently loaded errors/retries; no wait-for-slowest first card.
- Actual expense optimistic quick-add/delete/settle test cancels a pending bundle expense response, then late pre-write data cannot overwrite the row patch/rollback. Post-write salary/planner/snapshot refresh gets fresh data rather than earlier cohort outcomes.
- Actual Providers + 095 VaultLockProvider/VaultGate/AuthIdentityWatcher tests cover clear, lock/unlock, signout/identity invalidation, stale unlock, teardown and late old result; no old records/drafts recreate. Cover StrictMode lifecycle.
- Fair before/after bundle qualification; no speculative speed assertion from module count alone.
- All `pnpm check`, `pnpm test:ci`, `pnpm build` gates pass in isolated nonsecret fixture; all aggregate coverage metrics above 80% and existing stricter security floors retained. Heavy jobs serialized with root; normal hooks unchanged.
- Fresh independent source review, synthetic actual Next/browser workflow proof, README/comments review, scoped diff/SHA review, exact-green CI before root PR merge. No owner/private login.

## Risk and reversibility

Risk is stale financial cache being accepted after cancellation, overly broad subset fetching, a runtime module cycle, or grouping suppressing fresh retries. These block delivery until actual-hook/lifetime tests and qualified measurements pass. Remove the overview wrapper and optional context path to fall back to the existing reader behavior; single scoped Git revert, no schema rollback/data loss. Server work already started may finish after cancellation; client acceptance gates, not physical cancellation, preserve UI/cache lifetime.

## Review status and final verification

The implemented five-source cohort covers snapshots, salary, planner settings, expenses and trades. Root reviewed the ordinary §7.4 scope before edits, and the independent final source review matched all 18 application paths. All 28 scoped files match between the managed worktree and isolated synthetic fixture. No dependency, migration, crypto, shared Query default or protected-file change is included. The approved frontmatter remains blank; this is owner-authorized remediation, not an agent-approved feature. Application source is frozen. PR delivery and exact-head CI remain pending; no shipped status is claimed.

Final product gates passed: `pnpm check`, `pnpm test:ci` and `pnpm build` in the isolated fixture. There were 141 passing test files and 1,278 passing tests; aggregate coverage was 93.01% statements, 89.02% branches, 91.22% functions and 93.58% lines. The new action measured 100% coverage; the cohort helper measured 98.03% statements, 95% branches and 100% functions/lines. All existing and additive strict floors remain enforced. The product build used Next.js 16.3.8 Turbopack. Evidence: `108-five-source-check.log`, `108-five-source-test-ci.log`, `108-five-source-build.log`.

The focused suite passed 69 tests across five files, including the nine existing actual overview workflow tests. It covers pending StrictMode with retries disabled, null planner defaults, warm/subset reads, source failures and failed-only retries, surviving shared observers, sole-observer teardown, actual 095 lock/identity/cache-clear boundaries, stale unlock, optimistic expense success/failure rollback and late outcomes. Actual `useTrades` tests prove slow trades leave core sources ready, warm trades are not reread, outside-overview transport stays unchanged, and the existing update mutation starts a fresh trades-only cohort while canceling old data. Guard tests exercise the actual wrapper and existing trade reader with mocked identity/key/backend boundaries. UI workflow tests use a fixture guard; they are not authentication proof.

## Final browser and bundle evidence

Thirty alternating cold samples (five per build/profile, six discarded warmups) compare copied actual dashboard components/hooks and real Next Server Functions with fixed generated readers. Both production-webpack fixtures use identical generated inputs; final source matches the 18-path manifest. All measured runs disclosed eight recorded card markers and completed seven fixed source reads exactly once. The inferred initial Server Function request count was seven on baseline and three with the cohort; this inference uses owned resource paths and the known fixture graph, not HTTP method/header inspection.

| Profile     | Assets median ms, baseline → final | Salary median ms, baseline → final | Tax median ms, baseline → final | Last of eight observed cards median ms, baseline → final |
| ----------- | ---------------------------------: | ---------------------------------: | ------------------------------: | -------------------------------------------------------: |
| Fast assets |                        1,003 → 112 |                          826 → 825 |                     1,074 → 896 |                                              1,074 → 896 |
| Slow assets |                          989 → 826 |                           111 → 96 |                     1,075 → 146 |                                              1,075 → 826 |
| Slow trades |                          270 → 112 |                           95 → 112 |                     1,121 → 167 |                                              1,121 → 167 |

Slow-trades salary disclosure incurs 17 ms overhead. This is not a universal speed gain. These are loopback generated-data component/transport observations, not production latency, whole-dashboard readiness or perceptual paint. Markers are connected, nonzero-layout DOM samples at animation frames. The synthetic action guard resolves at 0 ms and both variants have identical 100 ms diagnostic metadata polling overhead; real identity/vault/network/database latency is not modeled. The product still performs the wrapper guard plus each reader's original guard. Existing initial SSR await-all prefetch is unchanged. No owner login, private data or real environment files were used.

Raw final trace: `108-final-three-profile-browser-traces.json`, SHA-256 `4e6b55bc9125dbeb91dc539d7c9e504c0d708d9cca650b4c3b0857eeced485c6`; independent analysis: `108-final-three-profile-browser-analysis.json`. The owned servers and browser tab were closed after sampling. These local synthetic artifacts are not repository fixtures.

Lifecycle evidence (`108-final-browser-lifecycle.json`) shows warm remount disclosing all eight markers in 6 ms with source counts/events unchanged. Expense failure made four default-retry attempts; the manual retry capture observes one further expense attempt, with other source counts unchanged. It does not establish retry success or bound future automatic attempts. Long-lived ResourceTiming buffer limits prevent using lifecycle outer counts as no-request proof. Actual unit integration tests separately prove successful failed-only retry and 095 cancellation. Earlier narrow responsive evidence covers the unchanged layout at an effective 375 px; it is not a new final screenshot or hosted/private-account workflow.

The diagnostic webpack fixture's initial nine-file emitted JavaScript union changed from 968,578 raw/293,328 gzip bytes to 970,156 raw/293,887 gzip bytes: +1,578 raw/+559 gzip. This is a qualified emitted-union comparison, not a measured production transfer or Turbopack bundle claim.

## Rejected prototype and scoped correction

The earlier four-source prototype is historical counterexample evidence. A three-sample alternating control with trades at 800 ms and core reads at 75 ms showed asset/salary/tax medians of 288/125/1,159 ms on baseline versus 922/922/976 ms in that prototype. Queuing the cohort allowed the separate trade action to dispatch first, causing a first-row regression. Root rejected that design before delivery and reviewed the precise five-source correction under existing ordinary §7.4 authorization on 2026-10-10, before correction edits. Evidence: `108-slow-trades-browser-traces.json` and its independent analysis.

The correction added only `src/features/equity/hooks/use-equity.ts` and `src/features/equity/index.ts` to the recorded path scope, for 28 files total. Existing guarded `getTrades` now joins the fifth allowlisted source through a public named export and type-only `EquityTradeData[]` context member. Its key, full history, arithmetic, guard and mutation refresh remain unchanged. There is no alternate portfolio cache or authorization memoization.

The initial hook baseline failed 2 of 4 tests before optional transports were installed (`108-hook-baseline.log`). Provider-wide cancellation also failed a surviving same-owner observer (`108-provider-lifetime.log`); Query-owned signals replaced that design. The old four-source gate logs remain evidence for their source snapshot, not the final implementation. Root confirmed `finish()` runs only after its cohort queue is detached, so an unreachable queue deletion was removed; `abort()` retains the queued-read identity check. No artificial mirror test was added for that unreachable branch.

## Skills, provenance and rollback

Fynfo AGENTS/Constitution feature ownership, public barrels and concise contract comments were applied alongside previously vetted Impeccable performance/error-readiness guidance. TemplateCentral/frontend-design skills are unavailable in this runtime; no invocation or installation is claimed. Project skills are unchanged.

The managed branch is `impl/108-overview-read-cohorts`, based on merged main `ee6e001957f1bb62a2e64479c00765cfc7e32396`. Root-owned 103 metadata was preserved in the retained path-scoped stash “Retain root-owned 103 shipped metadata before 108”; no stash deletion, branch deletion or history rewrite occurred. Final source hashes are recorded in `108-frozen-application-source.json`. Queries starting together coalesce; requests after dispatch start a fresh cohort. They do not reuse completed promises or provide an atomic database snapshot. Server work may continue after local cancellation; existing query signal/lifetime guards prevent obsolete acceptance. Rollback remains a scoped code revert without schema or data reversal.
