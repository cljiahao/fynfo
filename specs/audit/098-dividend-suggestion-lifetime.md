---
id: 098
slug: dividend-suggestion-lifetime
area: audit
status: owner-authorized
author: Codex
created: 2026-10-10
constitution_satisfies: ['§2.5', '§3.2', '§4', '§5.1', '§7.4', '§8.2']
constitution_overrides: []
---

# Audit 098: Dividend editor asynchronous lifetime

## Owner scope and evidence

Clarence's explicit full-project audit and sequential parallel-worktree continuation authorize ordinary reversible correctness/security remediation under §7.4. Root assigned this scoped batch after merged095 (base 31482852ce64e8685ae54fa30d61d43c4f890e92). Existing DividendFormDialog awaits provider data then applies a suggested amount and globally toasts captured shares/DPU without checking editor lifetime or changed inputs. Gate unmounts old protected content, but RootLayout's Toaster remains mounted. A closed/reopened editor can receive old results; a changed ticker/date/amount can be overwritten by a stale suggestion. Prove these with actual mounted form/deferred provider regressions before product edits.

## Recorded paths and solution

- src/features/equity/components/dividend-form.tsx: bind asynchronous suggestion/save UI effects to the active editor lifetime. Closing removes editor state; reopening creates a fresh editor. Reject old request completions after unmount, closing/reopening, record/input/holdings changes, and superseded requests. Current successful suggestions retain their arithmetic and update only unchanged relevant inputs. Use a short generic success toast; amounts already appear in the form. Stale success/error/close work must be inert. The latest mounted request may safely clear its own spinner after changed inputs/props; superseded or unmounted jobs cannot clear a newer spinner.
- src/features/equity/constants.ts if a shared durable message belongs there; no new helper module unless actual reuse warrants it.
- test/features/equity/dividend-form-lifetime.test.tsx: meaningful mounted actual-form/provider-deferred tests; preserve current success/error/save coverage in equity-ui.test.tsx.
- README.md: concise asynchronous editor lifetime contract.
- specs/audit/098-dividend-suggestion-lifetime.md: evidence, results, limits and second review.

No change to nearestDpu/sharesHeldAsOf/suggestAmount, provider success-array/error contracts, dates, currency, schemas, persistence, authorization, encryption, dependencies or protected paths. The parallel 099 batch owns provider failure semantics; coordinate and do not overlap. Client code already exists; lifecycle interactivity justifies any local client composition (§2.5).

## Acceptance and reversal

Baseline-failing deferred results must demonstrate no numeric toast after unmount, no effect after close/reopen, no overwrite when ticker/date/currency/amount/record/holdings change, and no stale error affecting the current editor. Current successful/error suggestions and save remain functional. Latest editor saves may still persist after close; only stale UI output is suppressed, not a server mutation rollback. Run applicable targeted checks, full pnpm check/test:ci/build, keep every coverage metric above 80% and all security floors unchanged, and obtain independent second review. Inspect README/comments for concise durable contracts. Single scoped revert; no migration/data rollback.

## Skills and limits

Use previously read Impeccable hardening/craft-floor guidance within existing primitives. Existing project verification instructions retained; privacy-sensitive context discovery is not rerun. TemplateCentral/frontend-design unavailable in this runtime; no installation/invocation claimed. No live provider/auth/vault/confidential data. This does not qualify estimated entitlement as actual received dividends or solve source-date/currency limitations. Baseline 11/11 actual-form deferred regressions fail on the shipped implementation (098-baseline-proof.log): stale numerical toast/errors, overwrite after close/reopen/input/record/holdings changes, and late save UI effects. Corrected targeted 52 tests pass (15 lifetime regressions and 37 incumbent equity UI tests); focused lint/typecheck pass. A layout-effect lifetime/revision guard changes before paint; current input snapshot and newest request identity qualify completions. Closing unmounts editor state; pending provider/server work is not cancelled or rolled back. Generic toast avoids numerical disclosure. The 099 batch owns provider failure semantics; successful array/exception contract preserved. Root and two independent parallel agents reviewed the resulting source and found no scoped blocker. All five gates pass in the isolated synthetic fixture: format, lint, typecheck, 124 files / 1075 tests, and production build (17 routes). Coverage is 93.47% statements, 88.82% branches, 91.10% functions and 93.78% lines; every existing aggregate and security floor is unchanged. This establishes mounted component and synthetic build behavior, not live provider, authenticated persistence or production browser evidence. Already dispatched saves can succeed without closing a newer/changed draft; durable duplicate/retry semantics remain outside this UI lifetime batch.

## Qualified browser proof

Root exercised the actual form with fake delayed provider and memory-only mutation adapters. Suggest, Escape, reopen and amount55 retained55 after the old successful reply, with no notification; closing showed zero pending and one completed provider request. A fresh fast suggestion populated20. Desktop and390px mobile proof were captured; mobile had no horizontal overflow. Browser proof did not dispatch a save or exercise the stale-failure path; mounted regressions cover those. No live provider, authenticated persistence, production browser or SSR/RSC evidence is claimed. The preview tab was closed, viewport reset and local server stopped.
