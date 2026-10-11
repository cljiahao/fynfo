---
id: 124
slug: dashboard-route-retry
area: fix
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.5'
  - '§3.1'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec124: Refetch server route failures with the framework retry callback

## Problem

Actual Next fixture Admin renders fixed15 page views/3 clicks/20%/3 signups. Root selected a one-shot readMarketingAggregates failure and reloaded: the actual dashboard route error appeared. Clicking Try again and waiting5s kept the same error digest1362906068, while a later full reload recovered Admin without another data change. The route adapter forwards Next reset, which clears boundary state but does not refetch a failed Server Component response. The visible retry consequently does not perform the required fresh read.

## Constitution check

- Satisfies §§2.5,3.1,4.1,4.2,4.4,7.4,8.2. No overrides.
- Preparation under standing owner audit/stabilization authorization. Root selected this exact three-path ordinary scope on2026-10-11 before implementation; approved remains blank, no self approval/new feature. No dependency/SQL/crypto/auth/protected or account access.
- Keep the existing client route error boundary and pinned Next16.3.8. Framework recovery is a UI-only fresh-read correction, not authorization bypass.

## Solution shape

Exactly three proposed tracked paths:

1. src/app/dashboard/error.tsx — accept the existing stable framework retry callback and forward it as the existing shared DashboardError reset callback. Keep error/digest propagation and visible UI unchanged. The route adapter is the only changed caller.
2. test/components/dashboard-error.test.tsx — retain current shared display/digest/reset tests; add actual DashboardRouteError mounted regression with distinct reset/retry spies asserting the user click invokes retry once, not reset. Add no-message leak control if useful; no new abstraction.
3. specs/fix/124-dashboard-route-retry.md — record selected scope, browser baseline, exact primary/pinned contracts, regression/gates/reviews and delivery before edits.

Pinned-source evidence: Next16.3.8 installed error-boundary.d.ts ErrorInfo has error/reset/retry; ErrorBoundaryHandler.retry starts a React transition, invokes AppRouterContext.refresh, then clears boundary error. Its reset only clears state. Pinned official source: https://raw.githubusercontent.com/vercel/next.js/v16.3.8/packages/next/src/client/components/error-boundary.tsx (reset98–100, retry102–107, supplied props121–123). Current official error API says retry refetches/re-renders, reset rerenders without refetch, stable retry since16.3.0: https://nextjs.org/docs/app/api-reference/file-conventions/error . Current catchError recovery guidance confirms distinction: https://nextjs.org/docs/app/api-reference/functions/catchError . Installed pinned code is decisive where stale search extracts show older reset/unstable_retry examples.

Use the existing framework callback rather than writing custom router.refresh/reset ordering or fallback navigation. This already handles the refresh→reset transition sequence for the pinned version. No Promise completion/recovery guarantee is invented: persistent upstream failure may still show the opaque error.

Actual shared consumers were inspected: Salary/Equity/Expenses/Assets client pages forward their own query refetch; DashboardOverview retries assets/salary separately; DistributionsSection forwards distributions refetch. They retain those existing callbacks and must not receive a global route refresh. Shared DashboardError component/public interface stays unchanged. Admin's actual getMarketingStats performs identity/ADMIN_EMAILS check before its telemetry read; no guard/data action changes.

README currently documents source-specific retry contracts, not this Next route callback. Review and retain it unchanged; no README expansion is needed for a framework adapter fix. Existing route comment is structure narration; it may be removed within this exact source file if selected, not expanded into unrelated cleanup. Preserve shared opaque UI/digest comments. Impeccable hardening guidance informs failure/retry clarity within existing UI, no design/artifact/dependency changes.

## Out of scope

Client query retry/cache policies, automatic retries, loading animations, disabled button state/pending protocols, error-message disclosure, admin allowlist, server action changes, SSR prefetch architecture, router/Next upgrade, custom global boundary, hard reload fallback, auth/provider proof or recovery guarantee.

## Acceptance

- [ ] Publish exact three-path ordinary audit before edits; stable retry contract confirmed against installed16.3.8 and pinned official source.
- [ ] Meaningful baseline: render actual route error with distinct reset/retry callbacks; click actual Try again; expected retry is not called while reset is. Shared DashboardError reset/display tests pass as controls. No missing import/mock/SDK problem counts as baseline.
- [ ] Corrected actual route invokes provided retry exactly once and does not invoke reset directly. Shared component still delegates to its provided callback, and existing query-refetch behavior/opaque digest rendering remains unchanged.
- [ ] Full check/test:ci/build, unchanged normal hooks and coverage/security floors pass; every aggregate above80%, no new dependency/protected edit.
- [ ] Independent review confirms scoped adapter-only mapping, pinned callback ordering and no alteration of client-query consumers.
- [ ] Actual production-webpack Next synthetic confirmation: one-shot readMarketingAggregates failure produces the existing boundary; user Try again triggers a new guarded source read and restores fixed Admin values without full reload. Record failure/readiness counts and retained screenshot/log. A persistent-error control stays opaque/retryable. Do not manufacture an RSC fetch via a unit mock or certify provider/production security.
- [ ] Root exact-head CI passes before merge; record precise source/hash evidence, mark shipped only after verified merge.

## Risk & reversibility

- Blast radius: only dashboard route-level error retry. It can retry any child Server Component failure caught by this boundary; failures in the boundary's own parent layout remain outside it.
- Reversibility: ordinary Git revert through hooks; no persisted data/recovery step.
- Backout: revert adapter mapping if pinned compiler/browser qualification fails. Preserve baseline and primary evidence. Future Next changes must be checked against actual callback contract, not blanket speculation.

## Open questions

- [x] Root selected exact three-path ordinary124 scope; preparation may proceed while123 targeted proof has priority. No jobs until coordinated release — Owner: root.
- [ ] Actual Next refreshed fixture proof scheduling — Owner: root; bounded existing loopback synthetic source, no private auth/provider calls.

## Results

Read-only proposal only. Actual runtime baseline is root-supplied synthetic browser evidence; no test/build/browser/product edit was performed during this investigation. Pinned source and primary docs strongly support the minimal callback correction. This does not infer all errors are server errors, change successful client query retry or prove production recovery.

## Root-selected preparation scope — before edits

The clean managed dividend tree was verified and new branch impl/124-dashboard-route-retry created from merged422b9ff, preserving prior clean closeout branch and all unrelated pending trees. Only the three paths listed above are authorized. Publish this record before adding meaningful route callback assertions; keep product adapter unchanged for baseline. All jobs wait for root/scenario light-slot release; no dependency, protected, shared error component or query consumer edits. Full gates/review precede normal delivery.

## Combined125 donor scheduling refinement — before product correction

Root selected combined125 delivery for this exact three-path donor, avoiding an independent full pipeline/PR. Only focused baseline/corrected route tests and light formatting/types/lint are run here. Full gates, actual Next synthetic retry qualification, normal hooks and exact-head CI belong to combined125 after verified122 integration; this donor is not shipped. Isolated090 ordinary fixture refresh from422b9ff preserves differing ordinary bytes externally before copying its tracked source/tests/tool configuration; dependencies, real env and protected enforcement files remain untouched. This refinement precedes the product callback correction.

## Test-consumer refinement — before the additional test edit

The corrected actual-route regression passed all four cases, but ordinary TypeScript exposed an existing direct route mount in `test/components/account-menu.test.tsx`: it supplies only `reset`, so it no longer represents the pinned framework retry contract. Root selected this evidence-backed test-only extension under the owner audit before its edit. This donor now contains exactly four paths: the original adapter, dashboard-error regression and audit, plus this existing account-menu test. Combined125 prospectively records fourteen paths before integration.

Change only this direct route fixture callback/name/assertion to `retry`; retain both opaque private-error/digest cases and every account-menu/logout/cache assertion. Do not add a production fallback to state-only reset. Acceptance: the two existing route mounts preserve redaction and invoke the provided retry once; both scoped test files and strict types/scoped lint pass. Rollback is ordinary Git revert of the same four donor files; no persisted data or framework/security contract changes.

## Focused baseline and callback correction

The isolated fixture ordinary tracked refresh copied627 allowlisted paths from immutable422b9ff and preserved differing source/config bytes outside the project (`124-fixture-refresh-provenance.json`). Installed dependencies and enforcement inputs were not copied or altered. This fixture is not a production, database or authentication environment.

The actual route test baseline failed exactly one of four tests: clicking Try again invoked the state-only callback, leaving the distinct provided framework retry spy uncalled. Three existing shared display/digest/reset controls passed (`124-baseline-red.log`). After the minimal mapping, all four passed (`124-targeted.log`). The route now forwards its supplied framework retry to the existing shared callback; shared/client-query consumers and opaque rendering are unchanged. The route's obvious boundary narration was removed within scope. This mounted callback proof does not establish a real RSC refetch/recovery; combined125 retains the actual Next synthetic confirmation requirement.

The first light typecheck identified the additional existing account-menu direct route fixture described above. Its correction is test-only; no production fallback or runtime protocol is added. Final focused account-menu/route verification and four-path donor review remain pending here; full gates, normal hooks and CI are deliberately deferred to the combined125 delivery, not claimed complete by this donor.

## Final focused donor evidence — 2026-10-11

Both existing test files passed all seven cases (`124-final-targeted.log`): the actual route delegates once to framework retry without directly invoking reset, shared reset controls remain unchanged, and account-menu logout/cache plus both private-error/digest controls are retained. Strict TypeScript and zero-warning scoped ESLint exited 0 (`124-final-typecheck.log`, `124-final-scoped-lint.log`); scoped formatting passed. The source/test correction is frozen with the four exact donor hashes in `124-four-path-freeze.json`. No full coverage run, production build, normal hooks, commit, push or independent PR was performed for this donor.

Root reviewed the original minimal callback approach and selected the narrow test-consumer extension. Fresh independent four-path review and actual Next synthetic refetch qualification remain required in combined125. Persistent Server Component failures may remain opaque after retry; this patch does not certify guaranteed recovery, production identity/RLS/encryption or faster loading. The initial proposal and early pending entries above are historical preparation records; current delivery is the combined125 candidate only.
