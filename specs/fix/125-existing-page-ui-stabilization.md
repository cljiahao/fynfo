---
id: 125
slug: existing-page-ui-stabilization
area: fix
status: shipped
author: Codex
created: 2026-10-11
approved:
shipped: 2026-10-11
impl_pr: https://github.com/cljiahao/fynfo/pull/44
supersedes:
constitution_satisfies:
  - '§2.5'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec125: Complete existing-page UI stabilization in one batch

## Problem

The synthetic page sweep found unnamed trade and optional allocation/relief controls, a distribution default using the UTC day instead of the local day, and a route retry that clears an error without fetching fresh server data. These are existing-page defects. Delivering each small correction separately repeats the full local, hook and CI pipeline without improving its regression evidence.

## Constitution check

Clarence authorized audit/remediation and parallel preparation, selected stabilization first, and asked to continue after interruption. Root selected this combined ordinary remediation under §7.4 on 2026-10-11. Approval remains blank; this records authorization rather than agent approval of a feature. Sections listed above are satisfied without overrides. No dependency, migration, encryption, authentication or protected-file change is included.

## Solution shape

Exactly fourteen tracked paths:

1. `specs/fix/125-existing-page-ui-stabilization.md`: this scope and verified results.
2. `specs/fix/123-equity-form-accessibility-and-local-date.md`: retain the prior four-path investigation and regression evidence; record combined delivery.
3. `src/features/equity/components/trade-form.tsx`: existing native labels and instance-unique control IDs, as recorded in 123.
4. `src/features/equity/components/dividend-form.tsx`: existing date-fns local-day default only; preserve saved date prefixes.
5. `test/features/equity/equity-ui.test.tsx`: 123 actual-form associations, focus, instance isolation and timezone regressions, preserving existing mutation controls.
6. `specs/fix/124-dashboard-route-retry.md`: retain the prior three-path investigation and regression evidence; record combined delivery.
7. `src/app/dashboard/error.tsx`: use pinned Next16.3.8 framework retry for the existing shared error callback.
8. `test/components/dashboard-error.test.tsx`: actual route callback regression and unchanged shared error controls.
9. `src/features/assets/components/monthly-investment-table.tsx`: name the existing RSP/SG/US percentage inputs without changing values or callbacks.
10. `src/features/assets/components/deployable-cash-breakdown.tsx`: name existing SG/US cash percentage inputs without changing complementary allocation arithmetic.
11. `test/features/assets/investment-interactions.test.tsx`: actual disclosure/control naming regressions and existing callback/value controls.
12. `src/features/salary/components/relief-row.tsx`: name existing amount/count/variant controls and scope checkbox IDs to each row instance; preserve catalog logic, disabled states and updates.
13. `test/features/salary/relief-row.test.tsx`: actual row names, label targeting and update regressions.
14. `test/components/account-menu.test.tsx`: adapt the existing direct route-error fixture to the framework retry prop; preserve logout, opaque-error and digest assertions.

123 and 124 were separately recorded before their own test preparation; their source implementation remains within those scopes. This umbrella is published before the additional allocation/relief edits. Donor work remains preserved in its worktrees until reviewed integration after 122 merges. One final source/config freeze, targeted regression checks, unchanged normal-hook full verification, PR and exact-head green merge cover the union. No additional fixture or dependency installation is required.

Source and browser evidence is recorded in 123/124 and external `stabilization-source-residuals.md`. Optional disclosures already contain real controls; hiding supplementary settings does not give those controls accessible names. Existing `InvestmentBreakdown` and `TaxReliefsDialog` are actual consumers. Use existing labels and concise contextual names, including percentage or SGD where needed. Keep the incumbent visual layout and basic errors visible.

Next's pinned retry refreshes the router then clears the boundary inside a transition; reset only clears the boundary. Primary source: https://raw.githubusercontent.com/vercel/next.js/v16.3.8/packages/next/src/client/components/error-boundary.tsx . Shared client-query refetch callbacks stay unchanged. No custom refresh-ordering or hard-reload fallback is introduced.

README review found no changed configuration or user workflow contract requiring expansion; retain it unchanged. Remove only obsolete structural narration within selected files, preserving fee rules, callback contracts and material financial assumptions. Impeccable hardening/craft guidance informs existing controls and failure recovery. Session context is already loaded and is not rerun. TemplateCentral/frontend-design are unavailable here; no installation or invocation is claimed.

## Out of scope

New features, tool dependencies, schemas, crypto, provider contracts, authenticated production access, query defaults, global error UI, tooltip redesign, financial formulas, saved record normalization and unrelated documentation closeout. No runtime speed gain or exhaustive accessibility/security claim is made.

## Acceptance

- [ ] Meaningful shipped-source baselines fail on missing names/associations, UTC/local default and reset-only recovery; existing payload/value/error controls pass.
- [ ] Corrected actual forms preserve disabled controls, fee/custom-broker behavior, saved date prefixes, numeric values and update payloads; mounted instances target their own labels.
- [ ] The route uses supplied framework retry once without directly invoking reset; shared query retries and opaque error rendering remain intact.
- [ ] Integrate reviewed donor bytes after 122 merges; preserve unrelated changes, branches and stashes.
- [ ] Full `pnpm check`, `pnpm test:ci`, `pnpm build` and unchanged normal hooks pass. Every aggregate coverage metric exceeds80%; security floors remain unchanged.
- [ ] Independent review covers the exact fourteen-path union and resulting source/config freeze.
- [ ] One bounded actual Next synthetic confirmation checks corrected names/defaults and one-shot admin read recovery without reload. Persistent errors remain opaque. Memory fixtures do not prove production identity, database, RLS or crypto behavior.
- [ ] PR links all three audit records; required CI is green on the exact head before merge. Mark shipped only after verified merge.

## Risk & reversibility

Blast radius is existing dashboard form/control naming, local new-distribution defaults and route error recovery. Incorrect associations could target another control; explicit names and multi-instance regression checks address that risk. Inputs, parsing, actions, encryption and persisted data contracts remain unchanged. Revert the ordinary batch through normal hooks if necessary; no migration rollback or persisted-data repair is required.

## Open questions

Root resolved the combined scope and delivery scheduling. Normal 122 delivery has priority; 123 focused checks precede 124 focused checks. Any uncertain framework/control behavior is investigated before edits. Unrelated residual findings remain separately recorded rather than silently expanding these fourteen paths.

## Results

The scope was published before additional product edits. The optional-control test-only baseline produced ten meaningful failures and nine passing controls across two existing test files, exposing absent accessible names and duplicate checkbox IDs without import/setup failures. The reviewed 123 donor retained ten baseline failures / 39 controls and 66 corrected tests across three files. The 124 donor retained its route-retry baseline and seven corrected tests across both existing route/account-menu files, with strict types and scoped lint/format passing. Both donor sets were hash-verified before integration. Combined focused verification, independent union review, bounded actual Next confirmation and normal-hook delivery remain pending; nothing in this batch is marked shipped.

## Pre-edit integration and optional-control contract

The managed batch branch is `impl/125-existing-page-ui-stabilization`, based on root-confirmed merged 122 at `89ed0cbaabac774d612da32f86adeeedaeadb962`. The clean 122 branch and retained stashes are preserved. The four reviewed 123 donor paths were copied only after checking each against its frozen manifest; their focused evidence remains 10 meaningful baseline failures / 39 passing controls, then 66 tests across three files and passing types/lint/format. They are integrated candidates, not separately shipped work.

Before optional-control product edits, two existing test copies were prepared externally with ten actual-control cases. Monthly inputs will expose contextual names `RSP monthly allocation (%)`, `SG Market monthly allocation (%)` and `US Market monthly allocation (%)`; deployable inputs will expose `SG deployable cash allocation (%)` and `US deployable cash allocation (%)`. Relief controls will expose the catalog label plus `amount (SGD)`, `count` or `option` as applicable. Native checkbox labels must target instance-unique IDs, including repeated catalog entries. Values, disabled states, complementary percentages and existing update payloads are unchanged. The shipped additional source bytes were unchanged during the genuine test-only baseline after the 124 focused slot released. No new widget, global control coordinator or financial calculation is introduced.

## Prospective existing route-test scope extension

Before editing the additional test, root selected `test/components/account-menu.test.tsx` as the fourteenth path. The 124 focused route tests passed four cases, but strict TypeScript identified this existing direct DashboardError consumer still supplying reset without the selected retry prop. This is a test-fixture compatibility correction, not another product defect or an authentication change. The donor author replaced only that direct route callback fixture, preserved logout/error/digest assertions and proved the existing account-menu controls alongside the route retry tests. Full union gates remain required under the owner-approved verification timing; normal hooks are unchanged. Rollback reverts the ordinary route/test corrections together, without changing stored data or session contracts. No other path is added.

## Verification timing

Clarence explicitly approved governance spec 126, reflected in constitution 4.1.0 §7.4. This batch runs meaningful targeted regressions and all active hooks before commit; unchanged normal pre-push build/check/coverage may supply the full local gates before the executable PR. No hook, security floor or green-CI requirement is removed. A redundant standalone full-gate cycle is not required when the resulting source is verified by the unchanged pre-push gates.

## Combined candidate verification

The five existing test files passed all 75 cases in the combined candidate. Strict TypeScript, scoped ESLint with zero warnings and audit formatting each exited zero. No standalone full coverage/build cycle has been run for this union: those unchanged gates remain mandatory through normal pre-push before the PR under the approved verification timing.

Fresh independent review of the five optional source/test paths found no scoped blocker. Its frozen hashes are recorded in `125-optional-independent-source-hashes.json` (SHA-256 `d18e3628b02095fe38ff2d4610f03f70c513638dc7085ff6523d88b4e0cc35e4`); the report is `125-optional-independent-source-review.md` (`2ad870bfd87e445eecd5dab774ae0be7a77bef650375d6561e7a759cd95dec69`). The reviewed donor tests and actual control tests preserve payloads, allocation arithmetic, disabled states, error opacity and saved date prefixes. One bounded actual Next confirmation and normal-hook verification remain pending. These are candidate results, not production or authenticated-database proof.

## Actual Next synthetic confirmation

Root qualified the six frozen product overrides against merged 122 in the existing isolated Next lab. The production webpack build exited zero; its closure had 25 entries / 289 modules with no missing or unsafe imports. Actual browser workflows confirmed the five contextual allocation names and complementary deployable-cash updates, named relief amount/count/option controls and existing disabled states, native trade Date-label focus, and a new distribution date matching the read-only browser-local day. Cancel retained saved records; timezone-boundary and saved-prefix behavior remain focused regression evidence.

The actual admin route recovered from a generated one-shot server read failure using Try again alone, without reload or navigation. Injecting another failure before retry kept the generic error opaque, and a subsequent retry recovered when it cleared. This qualifies the supplied pinned Next framework retry, not production identity, RLS, database availability, provider behavior or cryptography. The public fixed-memory action/identity/vault boundaries remained explicit. Proof: `125-next-corrected-browser-proof.md`. The owned server and tab were closed. Full unchanged normal-hook gates and exact-head green CI remain required; no speed or exhaustive accessibility/security claim is made.

## Verified delivery — 121 closeout

Root verified [PR44](https://github.com/cljiahao/fynfo/pull/44) exact head `b384ba3c07dc2a19540f8324819760c60f8eaab0` before normal merge. Required CI 38112259967/job114390083246 and preview checks succeeded; CI completed 2026-10-11T04:43:13Z. The merge is `03dadad7b1bfd835da4b597d68a7b8997621f0f3` at 2026-10-11T04:43:39Z. Root verified [public merged-commit production deployment](https://vercel.com/noxynx/fynfo/A8kaVnv4jEz9Cb44Sr6x7cfGe6Ny) SUCCESS updated 2026-10-11T04:44:26Z. Public deployment status does not prove private account, database/RLS, provider or cryptographic behavior.

This record shipped within combined 125, not through a separate donor PR. Unchanged normal hooks passed formatting, lint, strict types, production build and coverage: 144 files / 1,476 tests; statements 93.18%, branches 89.28%, functions 91.70%, lines 93.89%. Security floors remain unchanged. Earlier pending/candidate statements retain their historical stage; the approved field remains blank under owner-authorized remediation.
