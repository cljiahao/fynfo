---
id: 123
slug: equity-form-accessibility-and-local-date
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
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec123: Name trade controls and use local distribution defaults

## Problem

The actual Equity TradeFormDialog displays Ticker, Date, Broker, Shares, Price per Share and Fees labels, but none references its existing input/combobox. Root observed unnamed controls in the actual Next fixture; source confirms the missing id/htmlFor pairs. Users relying on field names or clicking labels cannot reliably identify/focus those controls. The dialog's CDP/P/O checkboxes are associated, but their fixed IDs would collide between mounted instances.

## Constitution check

- Satisfies §§2.5,3.2,4.1,4.2,4.4,7.4,8.2; no overrides.
- Ordinary accessibility remediation within Clarence's audit/stabilization scope. This is an external proposal, not self-approval; root selects the exact batch before implementation. Keep approved blank under §7.4. No dependency, migration, encryption, protected edit or product feature.
- Existing client boundary is retained for interactive form hooks. No action/data/interface change. Root additionally observed a concrete UTC-midnight discrepancy in the actual distribution dialog: its default date lags the local trade date.

## Solution shape

Exactly four proposed tracked paths:

1. src/features/equity/components/trade-form.tsx — one React useId prefix; pair six existing labels/native inputs and Broker's existing SelectTrigger. Scope CDP/P/O IDs through the same instance prefix while preserving all checked/disabled/fee behavior. No new abstraction or UI layout.
2. test/features/equity/equity-ui.test.tsx — extend existing actual mounted dialog tests with accessible-name/native association/focus and simultaneous-instance isolation regressions. Retain existing real-hook/action-spy payload, custom broker, P/O, fees, pending and error assertions.
3. src/features/equity/components/dividend-form.tsx — change only the new-record fallback date from UTC to the existing date-fns local format convention. Keep saved edit date prefix, labels, controls, suggestion/save lifetime and stored-date payload unchanged.
4. specs/fix/123-equity-form-accessibility-and-local-date.md — record selected scope, meaningful baseline, verification, independent review and results before implementation.

Actual consumer: src/app/dashboard/equity/page.tsx mounts one TradeFormDialog, using public feature export. Trade inputs are at trade-form.tsx lines201–212 (Ticker),247–254 (Date),256–290 (Broker),356–399 (numeric fields); associated fixed CDP/P/O IDs at305/315 and325/335. Recheck line numbers at actual selected base; no line-number assumptions drive edits.

Distribution form already pairs Ticker/Payment date/Amount received/Currency to controls in dividend-form.tsx223–295; existing equity-ui/dividend-form-lifetime tests use getByLabelText and cover suggestions, saves and deferred completion. Do not change its existing labels or styling. Its static IDs are a potential reusable multi-instance limitation; current DistributionsSection mounts one dialog, so no actual duplicate page bug is established and it stays outside this batch.

README is already adequate; no documentation contract needs expansion. Within the already scoped trade file remove only obvious JSX row/fee-breakdown/summary narration and redundant derived-state narration if selected; retain non-obvious saved custom broker, fee autofill/CDP business constraints. Impeccable hardening guidance was read for accessibility/error/control preservation; no detector, redesign, dependency/plugin invocation or artifact write beyond this external proposal occurred. Future implementation should use incumbent layout; no skill may expand these paths.

Data model/public API/encryption changes: none. Native control types, number parsing, RHF registration/onChange, min/step, date conversion, action selection, broker menus, fee computation and mutations remain unchanged. Action Buy/Sell controls already have button names; do not introduce unrelated radio semantics.

## Additional confirmed local-default evidence

DividendForm defaults use `d?.date?.slice(0,10) ?? new Date().toISOString().slice(0,10)`; the fallback is UTC, so Asia/Singapore2026-10-11T00:30 corresponds UTC2026-10-10T16:30 and gives yesterday. Root actual Next observed Payment date2026-10-10 vs Trade date2026-10-11. Existing buildTradeFormDefaults and ExpenseQuickAdd/table use date-fns `format(new Date(), 'yyyy-MM-dd')`, based on local calendar. No shared local-date helper exists in inspected source; reuse the installed format function rather than introducing an abstraction/dependency. Saved distribution edit dates deliberately retain their first10 prefix, and actions/store remain unchanged. This is a default-only correction, not a conversion of historical payment dates or global timezone policy.

Acceptance supplement: actual mounted new Distribution dialog under a fixed instant and explicitly verified Asia/Singapore local offset defaults2026-10-11 while UTC isOct10; before correction it fails meaningfully. Add UTC/negative-offset controls and saved edit-date prefix control, restore timers/TZ after tests. Reopening a new editor recomputes the current local day; existing late suggestion/save lifetime tests remain intact. Do not rely on expected dates constructed using the same defective function or count unsupported TZ setup as a calendar red.

## Out of scope

Distribution suggestion/provider/stored date semantics, trade async lifetime, crypto/guards/RLS, numeric/validation rules, source rename, layout, generic shared field helper, unrelated form cleanup, profile/household global ID changes. Additional allocation-input findings below are separate candidates, not automatic scope.

## Acceptance

- [ ] Record exact selected four paths before edits; ordinary owner audit authorization only, no invented approval.
- [ ] Meaningful shipped-source baseline: six trade fields cannot be found by their visible label/native accessible name; isolate those failures without missing modules/mock artifacts. Existing valid controls/payload tests remain passing controls.
- [ ] Corrected actual mounted dialog supports named Ticker textbox, Date label, Broker combobox, Shares/Price per Share/Fees spinbuttons. Native label.control/label htmlFor resolves to the intended control; user label click focuses native inputs, including date, and existing Radix broker trigger naming preserved. Do not use brittle generated-ID literal assertions.
- [ ] Two mounted TradeFormDialog instances have unique field/CDP/P/O IDs and each label references only its own control; actual portal scoping does not confuse the test. Checkbox behavior/disabled states remain unchanged. This is instance contract proof, not a claim current route mounts two simultaneously.
- [ ] Retain actual existing action-spy tests for fee overrides, custom broker, P/O, required errors, pending states and submit payloads; no rewritten assertions hiding changed behavior.
- [ ] Distribution named-control/lifetime tests remain passing controls; its only source change is the new-record local date fallback.
- [ ] Full pnpm check, test:ci and build plus normal hooks green; aggregate coverage above80% in every metric, stricter floors unchanged.
- [ ] Fresh independent review verifies only selected scope and preserved control contracts. Actual Next fixture label inspection may qualify corrected names/click focus after immutable merge, without another redundant per-copy browser build.
- [ ] Record exact hashes/logs; root checks exact-head CI before merge; mark shipped only after verified merge.

## Risk & reversibility

- Blast radius: trade label/ID association and new distribution local-day default only. Risk is mismatching label to a different control, collision under repeated instance mounts or an incorrect new-record local day.
- Reversibility: ordinary Git revert through normal hooks; no persisted data/migration.
- Backout: revert scoped association change if native/Radix behavior regresses; retain baseline/evidence. No runtime performance gain or exhaustive accessibility claim.

## Open questions

- [ ] Root selects exact four-path123 batch/timing after active122 delivery — Owner: root.
- [ ] Optional trade-file narrated comments removal — Owner: root; bounded to existing file, no business-rationale removal.

## Bounded remaining-label source check

Read-only actual consumers confirm Profile basic birth-year/residency/NS controls, household setup/create-goal/contribution fields, snapshot month/account/amount fields and scenario-name/planner inputs already have native associations or explicit names. These were source checks, not a complete rendered page audit or duplicate-ID proof. No edits proposed there.

Two concrete separate assets controls remain unnamed in inspected source: MonthlyInvestmentTable ratio inputs (monthly-investment-table.tsx63–75; row labels are td text, no label/aria name) and DeployableCashBreakdown SG/US percentage inputs (deployable-cash-breakdown.tsx109–121; sibling span labels have no association). Actual InvestmentBreakdown mounts both inside supplemental disclosure (lines272/283), so they are real consumers, not speculative unused files. Record as a later narrow source-confirmed accessibility candidate; root may select dedicated native labels/explicit names with real table/accordion tests. Do not silently bundle it into123 or claim current UI-only source inspection proves all page controls verified.

## Results

Preparation only: source/consumer/test inspection and root's actual Next DOM evidence. No tests, build, browser or product edits performed during this proposal. Implementation confidence is high for scoped native associations and existing local date-fns formatting; numerical/security/provider contracts stay out of scope.

## Selected implementation boundary — 2026-10-11

Root read the complete external proposal SHA17faa9990b963957b70fecbe9f2a9051750ee69a97d08e019d8957ae919c9842 and actual source/runtime, then selected exactly the four listed ordinary paths under the owner's stabilization-first audit direction (§7.4). This record is published before source/test edits. Earlier proposal/open-question wording is historical: scope and optional removal of obvious trade-row/derived-state narration are selected; preserve all non-obvious fee/CDP/custom-broker rationale. Approval stays blank because this records ordinary remediation authorization rather than approval of a new feature.

The reusable quote-currency-accuracy checkout was verified clean at117 head7b7a4769; normal fast-forward reached verified merged main422b9ff28d5d1b8a9e7cff42b0ca75ac1b90ab63, then branched impl/123-equity-form-accessibility-and-local-date. Prior branches and stashes are preserved.122 retains delivery priority. Baseline assertions may be prepared, but tests, types, full gates, builds and delivery hooks wait root's coordinated release; no product edit precedes meaningful baseline execution. The separate unnamed asset-allocation controls remain an unselected future candidate with no123 path expansion. No real env, private financial input, dependency, SQL, protected edit or hook bypass is authorized.

## Meaningful baseline and focused correction — 2026-10-11

Root assigned the idle117 synthetic fixture for123 after122 normal push completed. The ordinary tracked422b9ff sources/config/tests were refreshed with a positive file allowlist; prior ordinary fixture inputs were preserved externally before replacement. Dependencies remained the installed physical117 runtime, no install or env/enforcement/protected change. Existing tracked hooks are byte-identical before/after. Exact four scoped source/fixture hashes were recorded before baseline.

The actual mounted unchanged-source baseline (`123-baseline-red.log`) executed49 cases:10 meaningful failures and39 passing controls. Failures were the six missing native field associations/names, multi-instance target isolation, verified Asia/Singapore and America/New_York local dates, and new-editor local-day reopening. UTC and saved edit-prefix controls passed alongside existing payload/fee/P/O/pending/failure tests. All timezone offsets were explicitly asserted; no import, unsupported-timezone or infrastructure failure is counted as defect evidence.

The correction adds only one TradeForm useId prefix, existing six field label/native IDs and scoped CDP/P/O IDs. Numeric/controller/fee/date-conversion/mutation contracts remain unchanged; non-obvious custom-broker and fee/CDP rationale remain. Obvious row/derived-state narration was removed within the selected file. DividendForm changes only its new-record date fallback to installed date-fns local formatting; stored edit prefixes and suggestion/save lifetime remain unchanged. Native label clicks focus the intended inputs, all16 targets remain unique across actual mounted dialogs, and existing fee/manual override/custom broker/P/O/mutation controls pass.

Corrected focused tests passed66 cases in three files (`123-targeted.log`), including actual equity UI and unchanged dividend lifetime/trade-default controls. Temporary fixture TZ and fake-Date settings are restored after each case. This is local synthetic UI/hook/action-spy proof, not authenticated production, SQL, encryption or whole-app accessibility assurance.

## Combined delivery boundary — 2026-10-11

To avoid repeated full pipelines, root selected123 and124 plus bounded existing optional-control naming for one incumbent UI stabilization PR125. Its exact13-path combined audit was published separately before additional product edits.123 remains exactly the four donor paths above; no additional allocation source path is included in this donor. No independent123 full gates, commit, push or PR is authorized. Full gates/unchanged hooks/exact-head CI and merge belong to the combined125 delivery after verified122 integration.123 is not shipped, and later shipment metadata must follow actual combined merge evidence. Independent fresh donor review remains required.

Final light TypeScript and scoped zero-warning ESLint both exited0 (`123-typecheck.log`, `123-scoped-lint.log`, `123-light-exits.json`). Root independently read the actual product diff and found no scope or preserved-contract blocker. Formatting/diff checks and exact four-path hash freeze follow; no independent123 delivery or full-gate run occurred.

## Verified delivery — 121 closeout

Root verified [PR44](https://github.com/cljiahao/fynfo/pull/44) exact head `b384ba3c07dc2a19540f8324819760c60f8eaab0` before normal merge. Required CI 38112259967/job114390083246 and preview checks succeeded; CI completed 2026-10-11T04:43:13Z. The merge is `03dadad7b1bfd835da4b597d68a7b8997621f0f3` at 2026-10-11T04:43:39Z. Root verified [public merged-commit production deployment](https://vercel.com/noxynx/fynfo/A8kaVnv4jEz9Cb44Sr6x7cfGe6Ny) SUCCESS updated 2026-10-11T04:44:26Z. Public deployment status does not prove private account, database/RLS, provider or cryptographic behavior.

This record shipped within combined 125, not through a separate donor PR. Unchanged normal hooks passed formatting, lint, strict types, production build and coverage: 144 files / 1,476 tests; statements 93.18%, branches 89.28%, functions 91.70%, lines 93.89%. Security floors remain unchanged. Earlier pending/candidate statements retain their historical stage; the approved field remains blank under owner-authorized remediation.
