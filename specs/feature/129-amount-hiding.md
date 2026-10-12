---
id: 129
slug: amount-hiding
area: feature
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
constitution_satisfies:
  ['§2.4', '§2.5', '§2.6', '§2.7', '§3.1', '§4.1', '§4.4', '§5.1', '§8.2']
constitution_overrides: []
---

# Spec129: Household screen-sharing amount visibility

## Problem

Financial values appear across tables, summaries, chart labels and tooltips, search results and editing dialogs. Clarence confirmed on2026-10-11 that Fynfo is for his household, with no commercial plan. A simple Hide amounts control should prevent accidental presentation of figures while sharing a screen without changing saved records or losing unfinished edits.

## Authorization and constitution check

Approved072/081 authorize the roadmap and delegate routine UX decisions. Clarence explicitly renewed continuation on2026-10-11 and approved future ordinary source/test/docs publishing with normal hooks and exact-head greenCI. This prospective record bounds AF implementation; its blank approved field does not invent a separate owner approval. Dependencies, migrations, crypto and protected files remain separately gated. No implementation or full-feature verification is claimed by this draft.

Preserve existing encryption, vault identity, database actions, payloads, caching and financial math. New client state is justified by the interactive presentation toggle (§2.5); pages remain compositions and shared interfaces use named exports. No new dependency, schema, persistence, encryption or HARD-rule change.

## Solution shape

- Reuse the incumbent navbar, button and typography system. Clearly named Hide amounts / Show amounts control with keyboard operation and pressed state, available at desktop and mobile widths. Visible hidden-state explanation: show amounts before editing or exporting. Essential field labels, load failures, validation messages and financial assumptions stay visible.
- Presentation state is memory-only and scoped to the unlocked financial subtree. Verify it resets on vault lock and identity invalidation without weakening existing teardown. No localStorage, query-string, cookie or server persistence.
- Hidden monetary values render a fixed replacement rather than real figures inside blur, hidden DOM text, titles or accessible labels. Hide financial percentages, quantities and chart plots that could expose financial scale or composition; preserve descriptive labels and availability warnings. Hide chart tooltips/axes/data labels consistently. Do not reclassify admin aggregate telemetry as personal financial data.
- Require Show amounts before editing or exporting. Preserve drafts; do not silently save, discard or reinitialize them. Handle already-open portals and existing numeric controls as well as newly opened dialogs. Keep visible explanation and a Show amounts action where an operation is blocked.
- A toggle must not cause expense blur/debounce to save a draft. Prevent new financial mutation initiation while hidden, including keyboard/direct handler paths. A previously submitted operation may finish; do not imply that toggling cancels it. Its feedback must respect hidden presentation.
- Export checks visibility before starting and again immediately before download. If Hide is selected while asynchronous reads are pending, suppress that pending download even if Show is selected later; require a fresh explicit export. A file already downloaded cannot be concealed by the toggle.
- Search needs a dedicated policy because user-entered descriptions and result contexts can contain amounts outside currency formatters. Conceal results while hidden and require Show before financial search, retaining the existing open-only loading contract.

### Proposed affected paths, before implementation

Shared presentation module under src/features/privacy/ (constants, context/hooks, display and interaction boundaries, index barrel); src/app/dashboard/layout.tsx; src/components/layout/dashboard-navbar.tsx. Confirm exact module files and consumers before code, not a blanket directory permission.

Financial display consumers in src/features/assets/components/: category-breakdown, deployable-cash-breakdown, investment-breakdown, asset-bar-chart, market-allocation-table, market-deployment-card, summary-cards, snapshot-table, snapshot-form, planner-results, scenario-dialog, monthly-investment-table, salary-planner and planner-inputs.

Other consumers: src/features/review/components/monthly-review.tsx and monthly-review-sources.tsx; equity distributions-section, dividend-form, dividend-table, dividend-income-chart, holdings-table, portfolio-summary, trade-form, trade-form-summary, trade-table, yield-on-cost-table and dividend-scan-dialog; expenses expense-chart, expense-table, editable-expense-row, expense-quick-add, owed-summary and split-dialog; household goal-card, create-goal-dialog and add-contribution-dialog; salary relief-row, salary-chart, salary-summary-cards, salary-summary, salary-table, tax-reliefs-dialog and salary form; profile profile form, export-data-card and use-export-data; search record-search-dialog and record-search-task. Exact form filenames and additional generic-table/raw-input consumers still require inventory before edits.

Tests under test/ covering shared state, actual consumers and asynchronous interactions; README only for the resulting control and its limitations; this spec and roadmap progress for measured results. Record the exact implementation path list after resolving the inventory, before executable edits. No global currency formatter mutation or data-layer interception.

## Out of scope

No encryption/access-control claim, full identity concealment, network/devtools redaction, screenshot reversal, cancellation of already submitted database operations, automatic persistence or cross-tab synchronization. No commercial product redesign, admin-stat masking, security protocol changes, new dependencies or migrations. Existing plaintext export and lack of restore remain accurately disclosed.

## Acceptance

- [ ] Complete source/consumer inventory including raw inputs, generic cells, portals, chart SVG/accessibility and user-authored numeric strings; resolve exact paths before implementation.
- [ ] Hidden representative amounts absent from rendered text, accessible names, titles, inputs and chart/tooltip content across each selected route.
- [ ] Editing and export cannot initiate while hidden; attempted operations explain why.
- [ ] Hide transition cannot trigger blur/debounce save; drafts survive Show/Hide without silent mutation or lost edits.
- [ ] Deferred export completing after Hide cannot download, including Hide-then-Show race; a fresh Show/export works.
- [ ] Already-open dialogs/search/tooltip surfaces respect visibility; essential errors and assumptions remain available.
- [ ] Memory state resets on lock/account change; no new persistence or security changes.
- [ ] Desktop/mobile and keyboard synthetic Next/browser proof, with actual source fidelity recorded.
- [ ] Meaningful targeted regressions, independent second review, README/comment review, unchanged hooks, all five gates and exact-head greenCI before merge.
- [ ] Every aggregate coverage metric remains above80% and all incumbent stricter floors remain unchanged.

## Risk & reversibility

Broad presentation coverage can miss a consumer, lose a draft through unmounting, or cause a blur save while changing modes. Do not ship a universal Hide claim from a partial formatter inventory. Scope will be narrowed only with an honest named limitation and recorded evidence. Backout is an ordinary scoped Git revert; no database or record migration is involved.

## Open questions and implementation readiness

Owner delegated routine UX; chosen default is Show amounts before editing/export. The architecture remains under investigation: prove draft-preserving masking and blur/save coordination before executable edits. Existing export asynchronous completion and expense blur-save paths are confirmed source consumers, not proven defects without the new toggle. No implementation confidence or finished feature is claimed yet.

## Results

Prospective draft only. Source baseline b7a3f09590dcfc7d10d07fa5299dc15053f356ef, public deployment SUCCESS2026-10-11T14:26:30Z. Runtime source is unchanged. No heavy job was started for this proposal.

## Implementation scope confirmation — 2026-10-11

Clarence explicitly instructed: "go ahead to implement please." This approves the concrete129 proposal and its ordinary implementation; protected/dependency/schema/crypto boundaries remain unchanged. No agent approval is substituted.

Exact shared files selected before code: src/features/privacy/constants.ts, src/features/privacy/components/amount-visibility-provider.tsx, src/features/privacy/components/amount-visibility-toggle.tsx, src/features/privacy/components/financial-value.tsx, src/features/privacy/index.ts, src/app/dashboard/layout.tsx and src/components/layout/dashboard-navbar.tsx. Public shared interface: useAmountVisibility returns hidden, mask(value), canReveal(), getHideEpoch(), showAmounts(), hideAmounts(); FinancialValue conditionally renders a fixed replacement, AmountVisibilityToggle names the action. Stable imperative visibility/epoch reads guard queued actions before React effects settle. No mutation of global currency formatters. Existing consumers retain their hooks/local state; masking changes displayed values rather than unmounting editor ownership.

Consumer edits are the exact existing TSX paths named in the proposed consumer list, with salary form resolved to src/features/salary/components/salary-form.tsx and profile form to src/features/profile/components/profile-form.tsx. Include src/features/assets/components/overview.tsx only if inspection confirms an uncovered financial consumer (record before editing). Tests selected under test/features/privacy/ plus existing matching feature tests where regressions belong; README, this spec and docs/audit/2026-10-09-roadmap-progress.md record final behavior/results. Run one heavy job at a time; source work may be divided under081's explicit parallel preparation authorization. Implementation cannot ship until every route/consumer boundary is reviewed.

Consumer inventory supplement recorded before edits: src/features/assets/components/planning-scenarios.tsx and investment-allocation.tsx own saved scenario actions/names and allocation inputs; include them in assets coverage. src/features/household/components/goal-list.tsx and household-overview.tsx compose goal actions (guard entry points while preserving mounted dialog ownership if changed). src/features/expenses/components/expense-table-toolbar.tsx owns arbitrary search drafts and new-row controls; include its presentation/interaction boundary. No auth, crypto, server actions, database or admin changes are selected.

Independent-review supplement before corrections: include src/features/expenses/components/expense-type-select.tsx because its user-entered category query can contain figures. Keep React keys stable/raw; mask displayed names only. Masking must not destroy typed query drafts. The named visibility toggle is excluded from expense blur-save/cancel so keyboard navigation to it preserves the draft; already queued saves still require the hide epoch. Each already-open modal provides Show amounts within its focus trap.

Snapshot submit boundary follow-up before edits — 2026-10-12: guard submission initiation in the already scoped snapshot-form.tsx before React Hook Form asynchronous validation, and capture the hide epoch so Hide → Show while validation is pending cannot authorize the earlier submission. Add focused synthetic delayed-resolver coverage in snapshot-draft-visibility.test.tsx. Preserve visible validation/errors and ordinary fresh visible submissions.

## Prospective equity correction recovery - 2026-10-12

Before restoring independent-review fixes, include src/components/widgets/confirm-delete-dialog.tsx: optional disabled and notice props preserve existing callers while equity confirmations disable hidden deletion and provide Show amounts inside the focus trap. Correct scoped trade-form, dividend-form, trade-table, dividend-table, dividend-scan-dialog and test/features/privacy/equity-visibility.test.tsx. Forms retain essential labels and mounted blank disabled controls with imperative guards. Already-submitted imports may finish, with hidden completion feedback concealing counts. No dependencies, migrations, crypto or protected paths. Recovery is source preparation, not completed verification.

Recovery record — 2026-10-12: the original 2026-10-11 prospective salary boundary follow-up selected salary-summary.tsx and test/features/privacy/salary-relief-visibility.test.tsx, snapshot-draft-visibility.test.tsx and planner-debounce-visibility.test.tsx. Those lost edits are reconstructed in the replacement amount-hiding checkout: conceal selected relief variant suffix/count while preserving fixed assumptions, exercise actual SnapshotForm edit/new drafts and actual SalaryPlanner queued debounce suppression. This restores previously authorized scope, with no dependency, schema, crypto or protected change. These synthetic tests do not prove auth/RLS/database behavior.

Prospective scope before applying — 2026-10-12: include newly shipped src/features/import-review/components/statement-review.tsx and test/features/privacy/statement-review-visibility.test.tsx in129. Disable hidden review/extract/edit entry points, preserve mounted drafts and essential labels/issues, remove hidden canvas/raw source text, provide Show within the open modal, and invalidate late extraction with captured hide epoch while disposing stale local PDF resources. No dependency/schema/crypto/protected edit. Parent applies only after current verification job finishes. Synthetic PDF boundaries do not prove parser/database/auth/security behavior.

## Recovery and current verification — 2026-10-12

The earlier managed checkout was absent when work resumed. Scoped source was restored from the retained synthetic verification copy; the later independently reviewed equity and asset/salary fixes and regression tests were reconstructed from retained task history. A retained scoped Git stash preserves the recovered source before integration. The implementation branch fast-forwarded to merged PDF/JSON closeout291fd51 and reapplied cleanly; new PDF review privacy consumers were explicitly scoped before edits.

Corrected TypeScript verification passed. Targeted regressions passed13 files/98tests, including actual snapshot draft and async-validation boundaries, planner debounce, equity modal/form preservation and export interruption. PDF privacy plus incumbent statement review passed2files/9tests with real provider/portal, masked retained drafts, source canvas removal and late extraction/open disposal. Independent review found no remaining actionable scoped findings after corrections. Initial test-only unsupported query-option failure is preserved; gates were not weakened. These are synthetic consumer proofs, not private authentication/RLS/database/crypto qualification. Full normal hooks, browser verification and exact-head CI/merge remain pending; this is not shipped.

Browser limitation on2026-10-12: the synthetic Next lab compiled and served dashboard/vault routes with fixed-memory identity/action/provider adapters. Three in-app browser attempts failed with initialization/navigation CDP timeouts. No desktop/mobile screenshot, interactive browser completion or production auth/RLS proof is claimed. The owned lab server was stopped; no unrelated workers were terminated. This acceptance evidence remains unresolved.

Prospective equity submit boundary follow-up — 2026-10-12: the already scoped trade-form.tsx and dividend-form.tsx must reject hidden submit initiation before React Hook Form asynchronous validation. Capture the current hide epoch at the event boundary and require unchanged epoch plus canReveal in the validated callback before invoking the existing onSubmit. Preserve validation errors, draft ownership and fresh visible submissions. Add actual-provider regressions in the selected test/features/privacy/equity-visibility.test.tsx for hidden initiation followed immediately by Show, and visible initiation followed by Hide/Show before validation completes. No action/schema/dependency/crypto/protected edit.

Prospective profile/salary submit correction — 2026-10-12: within already selected profile-form.tsx and salary-form.tsx, reject hidden form initiation before React Hook Form validation and capture the hide epoch so a Hide → Show transition during validation cannot submit an earlier draft. Preserve existing validation and save feedback. Add actual-provider synthetic regressions in test/features/privacy/profile-salary-submit-visibility.test.tsx, including fresh visible retry. No dependency, schema, crypto, server action or protected edit.

Prospective provider lifetime correction — 2026-10-12: within already selected amount-visibility-provider.tsx, invalidate imperative reveal permission and the hide epoch synchronously when the presentation owner unmounts. Stale Show/Hide callbacks cannot reactivate a destroyed owner; captured mask callbacks conceal values after teardown. Keep initial visible rendering and React StrictMode effect replay operational. Add captured-API unmount and StrictMode lifetime regressions to existing visibility-boundaries.test.tsx. This is presentation lifecycle only; no auth, vault crypto or protected change.

Prospective registered-field blur correction — 2026-10-12: pinned React Hook Form reads native registered field values before distinguishing blur events. Hidden masked snapshot account/amount, trade ticker/shares/price/fees and dividend ticker/date/amount therefore require stable canReveal guards on inherited blur handlers, preserving ordinary visible validation. Add explicit focused-draft Hide/blur/Show/save regressions in existing snapshot/equity privacy suites, followed by native pointer/keyboard browser checks. Existing Controller fields retain stored values and need no conversion. No action/schema/dependency/crypto/protected edits.

Prospective chart measurement cleanup — 2026-10-12: native synthetic Next browser proof found Recharts' body-level recharts_measurement_span retains its last tick string after the chart is concealed or its route unmounts. Pinned Recharts DOMUtils confirms this global text measuring node. Within selected amount-visibility-provider.tsx, clear that transient measurement text when hiding and when the presentation owner tears down; preserve the reusable measuring node and chart behavior after Show. Add regression coverage in existing visibility-boundaries.test.tsx and confirm in the native browser that financial text is absent across the full body, not only main. No financial data, formatter, dependency, schema, crypto or protected edit.

Prospective search portal recovery — 2026-10-12: native synthetic browser opening search while amounts are hidden confirms the search field/results are concealed, but its focus-trapped dialog lacks a local explanation and Show action. Add the incumbent AmountsHiddenNotice inside already scoped record-search-task.tsx and actual provider/dialog regression coverage in test/features/search/record-search-dialog.test.tsx. Preserve lazy open-only loading, query status/errors and typed term ownership; no new search or security capability.

Prospective financial composition correction — 2026-10-12: synthetic native dashboard shows derived planner percentages in breakdown item labels while hidden; snapshot history distinguishes positive category values as Hidden from zero values as a dash. In already scoped planner-results.tsx, remove the parenthesized numeric allocation suffix from hidden display labels while preserving visible labels and fixed assumptions. In selected snapshot-table.tsx, apply the existing mask to the entire visible amount-or-dash representation in both desktop and compact cells. Inventory other selected consumers for the same conditional masking defect before edits; record any additional exact paths. Add actual consumer regressions to existing privacy tests. No financial calculation, data or dependency changes.

Prospective trade selector draft correction — 2026-10-12: failed actual-form regressions narrow the lost state to Broker after Hide/Show, while ticker/date/shares/price/fees restore. Pinned Radix SelectBubbleInput dispatches native change events when controlled values transition. Existing broker options never include an empty string; handleBrokerChange must reject the non-option empty sentinel as well as hidden calls, preserving selected broker drafts and all legitimate visible options. Keep exact payload assertions in the regression. No schema, action, data or dependency changes.

Financial zero-cell inventory supplement before edits — 2026-10-12: selected trade-table.tsx fee cells and market-allocation-table.tsx target, lacking and shares-to-buy cells have the same positive-only masking defect as snapshot-table.tsx. Mask the entire existing formatted-value-or-dash representation, leaving actual unavailable-data warnings intact. Add actual-consumer zero/nonzero concealment regressions in existing privacy suites. Conditional record availability, nonfinancial counts, dates and static assumptions remain descriptive context; this is not a claim to conceal all data existence or financial workflow state.

Exact additional selected regression path before source work: test/features/privacy/zero-value-cells.test.tsx owns actual snapshot/allocation/trade zero-and-positive cell masking coverage to keep concurrent agent edits isolated. Existing financial formatting/calculation remains unchanged.

## Final scoped verification before publication — 2026-10-12

Corrected targeted verification passed 17 files / 141 tests, covering actual provider, forms, search portals, snapshot/expense drafts, profile/export, planner debounce, statement-review masking, zero cells and existing consumers. Independent reviews found no remaining actionable scoped findings. Earlier failures are retained: sandbox dependency resolution, missing jsdom ResizeObserver and the native selector empty sentinel; no gate or assertion was weakened.

Native synthetic Next browser proof now resolves the earlier cold-navigation timeout: known route GET warmup completed before direct in-app navigation. Reviewed source overrides were SHA256 matched to the actual checkout. Desktop1440×900 and mobile390×844 verified focused snapshot drafts survive pointer/keyboard Hide/Show, disabled blank financial inputs, no horizontal page overflow, and expense Hide does not blur-save (fixed-memory write counter unchanged after debounce) while a fresh visible outside-row blur saves once. All selected routes were inspected; final confirmation conceals planner percentage labels and positive/zero asset cells, clears body-level Recharts measurement text and enables keyboard Show within the search focus trap. Profile editing/export remain disabled while hidden; errors and static assumptions remain visible. Final desktop/mobile screenshots and server/first-failure logs are retained in the calling workspace. Owned browser servers were stopped before later gates.

The browser uses explicit fixed-memory identity/vault/action/provider adapters. No real PIN, credentials, cookies or confidential records were accessed. Browser evidence is presentation/interaction proof, not actual authentication, RLS, crypto or database durability. Local PDF privacy tests use synthetic PDF session boundaries; no new real-bank parsing qualification is claimed. Conditional record availability and workflow state remain descriptive context under the named presentation-aid limitation. Normal hooks, full coverage/build and exact-head hosted CI/merge remain pending;129 is not shipped yet.
