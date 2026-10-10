---
id: '119'
slug: overview-ssr-query-key-boundary
area: fix
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  [
    '§2.1',
    '§2.3',
    '§2.4',
    '§2.5',
    '§2.6',
    '§4.1',
    '§4.2',
    '§4.5',
    '§7.4',
    '§8.2',
  ]
constitution_overrides: []
---

# Spec 119: Server-safe overview prefetch keys

## Problem

The dashboard intends to hydrate four independent datasets, but its Server Component imports their key constants from use-client hook modules. The actual Next.js 16.3.8 webpack server output transforms those exports into client-reference functions. TanStack Query 5.97 hashes each function to undefined and reuses one query, so only snapshots prefetch; client array-key observers then fetch missing datasets after hydration. This is a correctness defect discovered in the owner-authorized synthetic workflow audit, not a production latency measurement or a Supabase failure. The page also still fetches directly despite constitution §2.4.

This audit record documents ordinary remediation under Clarence's continuing owner-authorized audit scope and constitution §7.4. Root reviewed and selected the exact 20-path scope, then handed off implementation after verified PR39 merge 64e2dc9392fb6d4fd8bb3748b86963ebe3f47d85. The approved field remains blank: agents do not approve their own findings. Root subsequently verified 116 public production deployment SUCCESS at 18:15:37 UTC; private production workflows were not accessed. No dependencies, migrations, crypto changes or protected edits.

## Constitution check

Restore§2.4 by moving existing prefetching into a feature-owned Server Component; page composes it and the existing client overview body. Keep authenticated/vault-guarded existing actions, per-request QueryClient, force-dynamic and unchanged client data/cache/mutation contracts under§2.1/§2.3/§4.2. No new use-client component, global cache or authorization shortcut. Named exports/public feature boundaries follow§2.6. No HARD/SOFT override.

Original spec 020 (shipped 2026-06-02, owner-preapproved roadmap) explicitly required key exports from hooks and page-level prefetch; its documented §4.1 assertion does not grant an override of current §2.4. Preserve its approval/history unchanged.085's deferred unit test proves ordinary JavaScript behavior only and misses RSC transformation; append new contradictory compiler evidence rather than rewriting prior approvals.087 records the existing page drift and proposed streaming; streaming is not selected here.

## Solution shape

### Recorded paths before implementation

| Path                                                   | Change                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| specs/fix/119-overview-ssr-query-key-boundary.md       | Owner-audit scope, evidence, proof and rollback                                                            |
| src/features/assets/constants.ts                       | Define existing SNAPSHOTS_KEY and PLANNER_KEY array values in this neutral module                          |
| src/features/expenses/constants.ts                     | Define existing EXPENSE_KEY array value                                                                    |
| src/features/salary/constants.ts                       | Define existing SALARY_KEY array value                                                                     |
| src/features/assets/hooks/use-snapshots.ts             | Import/reexport neutral key, retain hooks and mutation behavior                                            |
| src/features/assets/hooks/use-planner-settings.ts      | Import/reexport neutral key                                                                                |
| src/features/expenses/hooks/use-expenses.ts            | Import/reexport neutral key; preserve optimistic logic                                                     |
| src/features/salary/hooks/use-salary.ts                | Import/reexport neutral key                                                                                |
| src/features/assets/index.ts                           | Export keys directly from neutral constants; retain hooks/public compatibility                             |
| src/features/expenses/index.ts                         | Export key directly from neutral constants                                                                 |
| src/features/salary/index.ts                           | Export key directly from neutral constants                                                                 |
| src/features/overview/components/overview-prefetch.tsx | New feature-owned async Server Component: same four prefetches/await-all/HydrationBoundary around children |
| src/features/overview/index.ts                         | Public named OverviewPrefetch export without replacing OverviewReadProvider                                |
| src/app/dashboard/(overview)/page.tsx                  | Thin force-dynamic composer, retains existing DashboardOverview client body                                |
| test/features/assets/dashboard-prefetch.test.tsx       | Update actual feature component/page coverage; meaningful distinct-key/deferred/failed-source regressions  |
| test/features/assets/overview-workflows.test.tsx       | Execute actual Server Component at four existing jsdom page-mount sites; preserve all assertions           |
| README.md                                              | Correct hydration/key scope, SSR versus post-unlock limitation                                             |
| specs/audit/085-dashboard-latency-baseline.md          | Append ordinary evidence correction: prior unit proof did not establish RSC key validity                   |
| specs/audit/087-dashboard-fetching-contract.md         | Append119 correctness boundary; pending-hydration remains proposal                                         |
| specs/fix/116-expense-draft-preservation.md            | Linked ordinary closeout: verified merge/date/PR/production facts only after root confirmation             |
| docs/audit/2026-10-09-roadmap-progress.md              | Scoped119 progress and verified116 delivery; no whole-roadmap completion claim                             |

21 recorded paths after the evidence-backed workflow-test extension below, including root-selected linked ordinary116 closeout only after its exact merge and public production confirmation. No source change outside this inventory; add a test path only with a recorded evidence-based reason before editing. Historical spec 020 remains untouched. Existing hook index reexports already remain compatible through the hook reexports; avoid unnecessary changes there.

Keep key bytes exactly ['snapshots'], ['planner-settings'], ['expenses'], ['salary']; readonly arrays, no new suffix, Query cache migration or key guessing. Server prefetch uses these neutral constants, never client hook exports. Existing client hooks/public consumers still import the same names. Feature-owned prefetch accepts children: ReactNode and creates a fresh QueryClient for each invocation, eager-starts the same four guarded actions and awaits all before default successful-only dehydration. Page retains force-dynamic and renders OverviewPrefetch around the existing DashboardOverview. No moves of route-owned client body, pending promise dehydration, cache fan-out, request guard memoization or expansion to trades/profile.

The public overview barrel now mixes the existing client provider and new server component: actual Next compiler closure/bundle review must prove no client import pulls a server-only guard/keystore module. Prefetch imports only neutral feature constants and existing public server-action surfaces; it must not import direct auth/crypto/provider code. If a separate server entry is needed to preserve the boundary, record that path/decision before edits rather than weakening a server-only guard.

### Evidence and regression method

Source fidelity/compiler evidence is in external overview-ssr-query-key-boundary-finding.md SHA256 `8c15138afa2fcdfa97baed139b9a4bf0b97af241b9922401d0ae208fd4c5f6fe`. Original page SHA256 `ba509dbc633af477239c4ef420945caf596b11d081be179bc74104dc3a199161`. Built server page SHA256 `a5c6a4f4a8e21be2c94438168213e2933e95d4809eb524aa11b7a2c0735ec929` registers all four key exports as client-reference functions and passes them to prefetchQuery. Installed Query utils.ts230 and queryCache.ts114 show stringify/hash reuse. Root public diagnostics observed first snapshot only followed by client cohort. This is stronger than a mocked ordinary-import test, but still synthetic webpack/compiler evidence, not production authentication proof.

Before edits, reproduce the cache collision with the installed QueryClient and four distinct compiled-style reference functions using deferred synthetic readers: only the first read/one undefined hash on old key form; four unchanged neutral arrays yield four independent reads/hashes. This model validates Query behavior only; actual Next compilation/hydration remains mandatory. Current unit test imported use-client constants as plain arrays and cannot count as RSC proof.

## Out of scope

Pending-query dehydration/streaming, new architecture from 087, auth memoization, query defaults/retries, shortened histories, trades/profile addition to SSR prefetch, expense optimistic changes, server-action/schema/crypto edits, new dependencies, SQL/migrations, protected governance/harness/CI and production login/private data. No universal speed or first-paint improvement claim. Await-all still gates initial SSR on its slowest source; post-PIN still uses108 cohort because unlock does not refresh the server route.

## Acceptance

- [ ] Root contract review selects exact ordinary 21-path scope; approved frontmatter stays blank unless actual owner approval is separately given.
- [ ] Red reproduction shows four compiled-style key functions collapse to one query; corrected neutral arrays have exact four independent hashes. Do not label this simulated reference test real RSC.
- [ ] Actual deferred prefetch component test proves eager independent starts, slowest-source await-all, four successful dehydrated keys and failed-only exclusion. Page is a thin composition; original keys/hooks/public imports remain compatible.
- [ ] Actual mounted existing overview, expenses optimistic success/failure/cancellation and 095 identity/lock tests remain green without weakening defaults/security floors.
- [ ] Refresh isolated external actual Next fixture to exact frozen corrected source; preserve old source/build/browser artifacts. Same reviewed fixed-memory adapters, request-time connection fidelity and generated data; no real auth/cookie/private DB.
- [ ] Actual production Next built server output has array-key hashes rather than client-reference query keys. Already-unlocked hard navigation starts all four core readers, emits four independent hydrated hashes, and client core observers make zero redundant reads; extra trade/profile/provider reads remain explicit.
- [ ] Locked initial route has no successful core data hydration; unlock mounts actual108 cohort, preserving independent readiness, partial-source retry and stale completion/lifetime suppression. No auth-proof claim from mock guard adapters.
- [ ] Synthetic delayed-source SSR controls prove preserved await-all versus post-unlock semantics separately. Report measured boundaries/overhead; no elapsed-time assertion in ordinary tests or universal speed claim.
- [ ] Full format/lint/typecheck/test:ci/build gates, aggregate metrics above80 and all strict security floors unchanged; independent review; exact-head CI/Vercel green before merge.
- [ ] README/comments and historical085/087 appendices state the compiler finding and bounded proof, preserving original approvals and prior measured artifacts.

## Risk & reversibility

Blast radius: initial dashboard hydration and definition origin of four unchanged shared Query keys. Wrong key export can break cache reuse/optimistic updates; mixed public barrel can pull unexpected runtime modules, so actual compilation and client mutation proof are required. One coherent code revert restores prior behavior; no data migration or destructive rollback. Retain external baseline artifacts, do not delete records or query data as rollback. No production deployment claim before merged green delivery.

## Open questions

- [ ] Root selected the 20-path scope and existing public barrel; actual corrected compilation must still validate its client/server closure.
- [ ] Root verified 116 merge and handed off execution from 64e2dc9392fb6d4fd8bb3748b86963ebe3f47d85; heavy jobs remain serialized.
- [ ] Root: approve explicit external public hydration-hash diagnostic instrumentation if actual rendered/RSC source evidence cannot establish client deduplication without it. No private introspection or browser guard workaround.

## Preparation status

Historical pre-implementation preparation: existing source/build evidence was investigated read-only before the root handoff; no application edits or gates had run at that stage. Original server 8773 stopped, tab 29 closed by root. No owner approval for broader087 streaming or pending recovery migrations is inferred.

## Qualified lightweight preparation evidence

Root permitted and accepted an installed Query 5.97 model, not actual RSC/auth execution. 119-query-key-collision-model.cjs SHA256 `242be07b70bdfbb78dd2865f40c72a49fe5fe2d5a0033df1a7ab3c81d34c087a`; log 119-query-key-collision-model.log SHA256 `891607e82c85a13e9aa116c51f2d06ad731d9865f757114d1b8705fe64fa2185`. Four distinct compiled-style functions collapse to one undefined-hash query/first snapshot reader; four unchanged arrays produce four exact hashes and readers. The script deliberately does not claim to run a React server reference or Next rendering.

119-integrated-next-baseline-frozen-hashes.json SHA256 `eabe817e63ca1e9f2c9eaa7ad05e2b4185810ad7309f244bfcfc4b17bc23790e` preserves 291 actual source/adapter paths and 199 compiled outputs from the existing request-time-fidelity baseline, excluding build caches/dependencies/private input. No baseline app source changed and no new build/server was run for this model. Existing root-owned browser evidence remains independently qualified.

Root selected the 20-path scope expansion before implementation: 116 closeout metadata and roadmap progress are ordinary linked documentation, contingent on verified exact 116 merge and public production evidence. Do not copy guessed or pending shipped facts, alter prior approvals, mark 119 approved or implement before root's exact 116 merge handoff.

## Authoritative contract references

- [React use-client boundary](https://react.dev/reference/rsc/use-client): a client directive defines a module dependency boundary; server imports from that boundary are restricted to supported React uses. This supports keeping shared query-key values in neutral modules, but does not establish this application's exact compiled representation or cache collision.
- [Next.js use-client directive](https://nextjs.org/docs/app/api-reference/directives/use-client): documents the client/server entry-point boundary and serializable props. This is general framework guidance; the preserved Next.js 16.3.8 compiled output is the decisive evidence for these four imported key exports.
- [TanStack Query advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr): documents Server Component prefetching and passing dehydrated cache state through HydrationBoundary. Its pending-query support is not selected for 119; existing await-all and successful-query dehydration remain unchanged.

These current documentation pages were checked during preparation. They may describe newer releases than the project's installed versions. The exact installed TanStack Query 5.97 hashing source, preserved Next.js 16.3.8 compiler output and qualified collision model establish the application-specific finding; general documentation alone does not prove it. Actual corrected Next compilation and synthetic hydration evidence remain required.

## Implementation handoff

Root authorized this recorded ordinary batch after PR39 merged at 2026-10-10T18:14:57Z. The clean managed tree is on impl/119-overview-ssr-query-key-boundary from exact merge 64e2dc9392fb6d4fd8bb3748b86963ebe3f47d85. Preserve prior branches, stashes, model and built baseline. Scope was published before source edits. Actual-page regression represents compiled references only at the original client-hook boundary; exact corrected Next build/hydration remains required. The linked 116 closeout now records only root-confirmed merge and public production SUCCESS facts.

## Skills and scoped verification status

The full Fynfo constitution and supplied AGENTS protocol were reviewed for this batch. No visual interface redesign or new primitive is introduced. templateCentral/frontend-design are not available callable skills in this session; do not claim their invocation or install a dependency to obtain them. Preserve Fynfo's documented architecture deviations and concise contract comments. Existing project verification tools and unchanged normal hooks remain required.

The actual shipped page with compiled-reference values mocked only at its original client-hook boundary failed because a reader was never called; it did not fail on a missing module/import. The correction passes five actual page/feature tests and TypeScript. This seam qualifies the Query behavior; preserved compiled-main and corrected actual Next hydration evidence must establish the RSC behavior change. External corrected fixture types and runtime closure passed before the reviewed build. A default pnpm shim attempted sandbox-blocked repair during the first test command; no dependency/lock installation or change occurred. Direct installed Vitest/TypeScript runtimes were used for targeted proof. External refresh manifest-field mistakes were corrected before completed manifest publication; preserved baseline bytes remain SHA-verified.

## Reviewed compiler and browser evidence

Five actual page/feature regressions pass, and scoped TypeScript passes. The meaningful pre-remediation page test failed on an absent reader, while the existing module imports succeeded. Independent source review accepted the same fourteen source/test hashes: report 119-independent-source-review.md SHA256 `078814ec2a730394458352586c2b17601328694869b223fa430b11cb1b80d223`.

Corrected external production webpack build exits 0 using installed Next.js 16.3.8 and exact product source copies. All five dashboard routes remain dynamic. Compiler proof 119-corrected-compiler-proof.json SHA256 `f456b1324b6c27d1c6f43301203582f1b891c4dd89c49659b4649e7e1e20c5e5` traces prefetch to neutral arrays: module 43142 exports snapshots/planner keys, module 75994 exports expenses, and salary is the local unchanged array. Unused hook client references remain in server output; they are no longer the keys used by prefetch. The overview client-reference manifest includes the client provider but no server prefetch component, and no OverviewPrefetch name occurs in emitted client chunks. Static closure passes 18 entries/229 modules with no missing or unaliased unsafe paths.

Root's actual Next browser qualification is recorded in 119-root-actual-next-browser-proof.md. Initial locked rendering has the real vault dialog and no successful queryHash hydration. Synthetic unlock mounts the actual 108 client path, reading each core source once. Intentional already-unlocked reload emits exactly four DOM-backed RSC queryHash entries: snapshots, salary, planner-settings and expenses. Core read counters advance from 1 to2 once and remain 2 after settlement; trade/profile/FX reads are counted separately. Fixed assets 8000, salary 5000 and spending 25 remain visible, with missing previous snapshot qualified. No redundant core client read was observed in this bounded workflow.

This is synthetic actual-component/compiler/cache proof with reviewed fixed-memory boundaries, not production paint, auth, SQL, crypto or private-record evidence. No additional diagnostics or product-prefetch replacement were introduced. The owned server 22276 was stopped and root closed tab 30 and left the viewport at its default. Preserve the frozen compiled-main one-source evidence alongside this corrected result. Full unchanged product gates and final document review remain pending.

## Recorded workflow-test scope extension before edit

The first full pnpm check passed, then test:ci exposed four existing overview-workflows failures because jsdom cannot execute the newly feature-owned async Server Component returned by the thin page. Actual Next browser hydration already passes; this is the existing unit renderer boundary. Root reviewed and selected test/features/assets/overview-workflows.test.tsx as the 21st validation path before edit. Preserve all mocks, providers, assertions and timeouts. A small test helper will assert the actual page's OverviewPrefetch component identity and await the actual exported component with page.props before rendering at the four existing page-mount sites. Do not substitute prefetch logic or weaken readiness/cache assertions. Finish and retain the failed full run before modifying test source; then run meaningful focused regressions and fresh review before justified full gate rerun. No product-source change or additional browser build is required.

The first full run completed: pnpm check exit 0; test:ci exit 1 with exactly four workflow mount-boundary failures and 1,432 passing tests (1,436 total, 144 files). The pipeline correctly stopped before product build. Log 119-product-test-ci.log is retained. The selected helper adjustment was made only after that run completed; product source stays frozen.

## Final local verification

After the reviewed test-renderer correction, all unchanged local gates passed: pnpm check exit 0 (route logging, formatting, lint with zero warnings and TypeScript), pnpm test:ci exit 0 (144 files/1,436 tests), and pnpm build exit 0 (Next.js 16.3.8 optimized Turbopack build). Aggregate coverage: 93.08% statements, 89.11% branches, 91.42% functions and 93.79% lines. Every metric is above the owner's 80% floor and existing stricter security thresholds remain unchanged. Final logs use 119-product-\*-final.log; 119-gate-exits.json records exact exits. The initial four-test renderer failure remains retained rather than mislabeled as a product bug.

Fresh review accepted the actual workflow helper without weakening assertions: report 119-workflow-independent-review.md SHA256 477814e6dc0921bb5a22c7fcbe60fb7a2b53764374e44b31767e6b0f4561a726. The same product source/compiler/browser proof remains frozen. Existing pnpm 11.4 runtime was used with fixture-only pnpm_config_verify_deps_before_run=false to prevent automatic dependency repair; all gate scripts and normal hooks remain required. No dependency installation, global setting change or hook bypass occurred. Normal commit/push hooks and exact-head CI/preview delivery follow; 119 is not shipped until verified merge.
