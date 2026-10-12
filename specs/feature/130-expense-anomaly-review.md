---
id: 130
slug: expense-anomaly-review
area: feature
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
constitution_satisfies:
  [
    '§1.1',
    '§2.1',
    '§2.3',
    '§2.4',
    '§2.5',
    '§2.6',
    '§2.7',
    '§3.1',
    '§4.1',
    '§4.4',
    '§5.1',
    '§8.2',
  ]
constitution_overrides: []
---

# Spec 130: Review unusually high recorded category spending

## Problem

Clarence and his household can inspect expense rows and monthly charts, but identifying a category whose recorded personal spending is substantially higher than recent recorded months requires manual comparison. A small, explicit review can surface records worth checking without asserting that they are incorrect, recommending financial behavior, or changing saved expenses.

Approved roadmap 081 names batch AB, expense anomaly review, as suggestions only with explicit review. This document prepares a concrete first batch in a separate worktree at baseline `b7a3f09590dcfc7d10d07fa5299dc15053f356ef`. It is a proposal, not evidence of implementation, owner approval of these exact thresholds, complete household bookkeeping, or production verification. Parent review of the concrete contract remains required before implementation in this preparation pass.

## Constitution check

Keep existing authenticated, vault-gated expense reads and encryption unchanged (§2.1, §2.3, §5.1). The page only composes a feature component (§2.4). Interactive disclosure and local review-month state justify a client component (§2.5). Named public exports use the expense barrel (§2.6, §2.7). Existing Zod, React Query, shadcn and currency formatters suffice; no new dependency (§3.1). Full gates, independent review and exact-head green CI remain mandatory (§4.1, §4.4). No protected file, database, migration, crypto, secret or deployment changes (§8.2). No SOFT override.

## Source evidence and boundaries

- `src/features/expenses/actions/expense-actions.ts`: `getExpenses` calls `requireActionContext`, reads all expense records and associated splits with `readAllRows`, exact counts and stable ordering, then decrypts. A returned complete history is distinct from a table page. Preserve this action; do not introduce another read or server-side financial analysis.
- `src/features/expenses/hooks/use-expenses.ts`: `useExpenses` owns the shared expense query, also used by the overview transport. Upsert/delete/settlement optimistically update that cache and roll back failures. This feature must not treat a pending optimistic mutation or failed/background refresh as a confirmed analysis.
- `src/features/expenses/components/expense-table.tsx`: filtering, sorting and pagination derive subsets; these are unsuitable inputs for an all-record comparison. No unsaved `newRows` enter the review.
- `src/features/expenses/types.ts`: expense amounts are recorded in the existing SGD model; there is no currency field. Categories are a fixed union. Do not introduce FX conversion or guess imported currencies.
- `src/features/expenses/lib/split-amounts.ts`: existing validation checks finite, nonnegative, safe rounded cents and shares no larger than the total. Reuse `getSplitAllocationError` for shared amounts.
- `src/features/review/lib/monthly-review.ts`: monthly review rounds each gross/share amount to cents, subtracts all other people's shares regardless of settlement, and groups by the recorded date prefix. Reuse that arithmetic contract, not its unvalidated assumptions about malformed legacy input. Do not refactor monthly review in this batch.
- `src/features/expenses/components/expense-chart.tsx`: charts presently derive personal share in floating currency units and fill absent months with zero. The anomaly review must not reuse that zero-filled series or claim identical precision. Chart cleanup is outside this proposal.
- `src/app/dashboard/expenses/page.tsx`: composes chart, owed summary, quick add and table, with explicit loading/error boundaries. Add one feature composition only.

## Solution shape

### Deterministic comparison

Public pure API: `buildExpenseAnomalyReview(expenses, selectedMonth, currentSingaporeMonth)` returns an immutable typed review result with comparison months, category availability reasons and suggestions. Time is an explicit input; the pure builder must not read the clock, storage, network or mutate the expense array. Validate both month keys before month arithmetic; reject current/future selected months. Support year rollover with bounded calendar-month arithmetic, not host-local date parsing.

1. Review one fully elapsed calendar month, initially the previous month in Singapore. Offer a labelled Month input for earlier months. Determine the current Singapore month using `Intl.DateTimeFormat` with explicit `Asia/Singapore` and numeric `formatToParts`; never infer it from host/device timezone. A mounted component refreshes its clock snapshot when the owner starts or refreshes a review. No timer or persistence.
2. Compare each category in that selected month to exactly the preceding three calendar months. Require at least one valid recorded expense in that category in all four months. A missing category/month is unavailable, not zero, and must not be replaced by an older nonconsecutive month. All categories participate, including insurance: this is recorded personal spending, not the salary allocation simulator.
3. Personal share is gross cents minus all rounded other-person share cents for `shared` expenses. `self` uses gross cents and ignores historical stale split rows, matching existing self-record semantics. Settlement status never changes spending. Fully allocated shared bills may have a genuine zero personal share while still counting as recorded history.
4. Convert each finite nonnegative amount to `Math.round(amount * 100)` and require safe integer cents. Require gross amounts to be positive. Reject invalid shared allocations using the existing split validator; never clamp negative personal shares. Check every category/month accumulator with `Number.isSafeInteger`; overflow makes that category unavailable. Do not calculate ratios from unsafe values.
5. The baseline is the median of the three preceding monthly category totals in cents. A zero baseline yields an explicit unavailable comparison, not infinity or an anomaly.
6. Suggest review only when both conditions hold: selected personal-share total is at least twice the median, and the excess is at least SGD 50 (5,000 cents). Thresholds are fixed named constants for this first batch, explicitly shown in the explanation; they are a household heuristic, not a validated statistical detector. Use integer comparisons with safe arithmetic rather than rounded display percentages to decide eligibility. At the exact boundary, a suggestion is included.
7. Sort suggestions by descending excess cents, then the fixed expense-category order for ties. Do not randomize or rank by financial advice. Each suggestion includes current total, median, excess, the three exact baseline month totals, and all selected-month source records for that category.
8. Order source records by recorded calendar date, then record ID as a deterministic tiebreaker. Do not deduplicate by matching descriptions or amounts. Duplicate IDs in the analysis window invalidate the whole review because record identity is ambiguous.

### Dates and malformed records

Use the recorded calendar date (`date.slice(0, 10)`) and its month, as existing monthly review does. Validate the calendar date and full date/timestamp with the existing expense-schema date contract. Preserve timestamp prefixes even when offsets would place the instant in another UTC month; do not silently move historical records between months. Clearly state “Grouped by recorded expense date.”

An invalid date cannot safely be located outside the analysis window, so it makes the whole review unavailable. An unknown category or split type inside the four-month window also makes the whole review unavailable. Relevant known-category records with invalid gross amounts, unsafe values or invalid shared splits make that category unavailable. Display the affected category and reason; do not present an apparently successful comparison after silently dropping invalid records. Invalid values in a validly dated record outside the analysis window do not alter this review. Empty history is a valid no-history state, with no conclusion about actual spending.

Known category label, date, source IDs and availability reasons must remain separate from user-authored descriptions. Raw exception text is never rendered. Valid display descriptions are text, never HTML. No confidential record or amount goes into logs, query strings, local storage, telemetry or error reporting.

### Explicit review and minimal UI

Add a collapsed “Review spending changes” disclosure below the existing chart/owed section and above Quick Add. Use existing type, spacing, buttons and accordion/list primitives; do not add another dashboard, charts, score, traffic-light risk classification or commercial onboarding.

Opening the disclosure does not mutate records. Show the review month and a named “Review recorded spending” action. Results are computed only on that explicit action from the entire successfully loaded current expense history. Keep one immutable analysis snapshot in memory and mark it stale whenever the expense data reference, selected month or query-readiness state changes; hide prior suggestion values and require a fresh Review rather than silently substituting current rows under old explanations.

The component reads the existing expense query through `useExpenses` and uses the installed React Query `useIsMutating` to suppress review initiation/results while any mutation is pending. This conservative global guard avoids attributing pending optimistic rows to confirmed history without changing mutation keys or action contracts. Suppress results on query error or while fetching, including errors with cached data; retain an opaque availability message and a Retry action using the existing refetch. A successful empty read stays distinct from a failure. Old results must not reappear after a failed mutation or refresh; a fresh explicit review is required after readiness returns.

Use clear copy such as “Groceries recorded higher than recent months” and “SGD 250 this month; the median of the previous three recorded months was SGD 100.” Include the exact baseline months and fixed rule in an expandable explanation. State “Recorded data may be incomplete. This is a comparison to check, not a spending recommendation.” Never say fraud, mistake, overspending, reconciled, complete, safe or statistically significant.

A suggestion expands a paginated read-only source list containing date, description, gross amount, other shares and personal share. Totals always include every matching record across pages. Use the existing `PaginationControls`, a fixed page size, and reset the source page when the category/review snapshot changes. No automatic edit, delete, settle, dismissal persistence or mutation callback. The owner uses the existing expense table independently if a correction is wanted; this batch does not invent a row-edit deep link.

No suggestions should read “No category meets this review rule” with availability counts and limitations, rather than “No anomalies.” Categories missing baseline data, zero baselines and invalid records remain visible as availability notes. Month input errors and query failures remain visible.

### Integration with amount hiding 129

This isolated baseline predates 129. Implementation must integrate the merged privacy barrel before delivery. While hidden, do not initiate an analysis or render suggestion totals, baseline values, ratios or user-authored source descriptions. Keep labels, fixed rule, assumptions, errors and the existing Show amounts explanation visible. Hide must clear the rendered analysis snapshot and invalidate it, including Hide-then-Show: Show permits a fresh explicit Review, not automatic resurfacing of a stale result. No additional privacy state/provider or formatter mutation. Tests must exercise the actual 129 provider and toggle after integration.

### Exact proposed paths

Add:

- `src/features/expenses/lib/expense-anomalies.ts`: pure validation, cent arithmetic, calendar windows, baseline and suggestions; named exports and result types.
- `src/features/expenses/components/expense-anomaly-review.tsx`: explicit review disclosure, month/readiness state, explanation, availability and read-only source pagination; owns memory-only review snapshot.
- `test/features/expenses/expense-anomalies.test.ts`: deterministic math/window/invalid-data cases.
- `test/features/expenses/expense-anomaly-review.test.tsx`: real consumer readiness, explicit action, source pagination, masking and stale-snapshot interactions with synthetic fixtures.

Edit:

- `src/features/expenses/constants.ts`: named fixed review thresholds and source page sizes only.
- `src/features/expenses/components/index.ts`: component export; the existing root expense barrel already re-exports components.
- `src/app/dashboard/expenses/page.tsx`: import and compose the feature component; no page fetching or calculation.
- `README.md`: describe this household review and recorded-data/threshold limitations after actual verification.
- `specs/feature/130-expense-anomaly-review.md`: authorization and measured results.
- `docs/audit/2026-10-09-roadmap-progress.md`: actual delivery outcome after verification/merge.

Existing actions, schemas, encryption, hooks, monthly review, charts, expense editors, table filters and global/privacy modules are read-only consumers for this first batch. If a prerequisite changes these paths, record that bounded addition before editing; do not silently expand this contract.

## Out of scope

No record-level merchant identity matching, duplicate detection, recurring/subscription detection, machine learning, external services, notifications, anomaly scores, suggestions about spending reductions, household shared database analysis, additional currencies, tax or investment advice. No automatic changes or saved review/dismissal status. No historical repair, schema changes, refactor of existing expense math, protected-file edits, dependencies or private production data access.

## Acceptance

- [ ] Selected elapsed month and three exact prior months, year rollover, leap-day/date-offset grouping and invalid/current/future period behavior are deterministic across host timezones.
- [ ] Integer-cent self/shared arithmetic, settled/unsettled invariance, fully allocated zero personal share, cent rounding, invalid allocations, unknown metadata, duplicate IDs and overflow are covered.
- [ ] Exact double-and-SGD50 boundary, each condition alone failing, zero baseline, median selection, sparse category/month history, all categories including insurance, ties and shuffled input order are tested.
- [ ] Full history is independent of table filters/pages; source pagination does not change comparison totals. Builder leaves input records untouched.
- [ ] No suggestions or mutation initiate without an explicit Review action; component imports no mutation callbacks. No-results wording distinguishes rule outcome, unavailable comparison and absent records.
- [ ] Query load/error/background error/refetch and pending optimistic mutation states cannot show cached analysis as confirmed; changing records/month/readiness invalidates prior results until fresh Review.
- [ ] Hide, already-expanded source list, and Hide-then-Show conceal rendered amounts/description text and require fresh Review; input labels/errors/assumptions remain available.
- [ ] Keyboard and mobile synthetic browser inspection proves disclosure, month, review, source paging, loading/error and hidden states against the final integrated source.
- [ ] Independent second review and README/comment check completed; synthetic UI evidence is clearly separated from actual auth/RLS/encryption/database proof.
- [ ] `pnpm check`, `pnpm test:ci` and `pnpm build` green; normal hooks unchanged; every aggregate metric above 80% and stronger security floors unchanged.
- [ ] Exact-head required CI green before merge; only then record shipped metadata.

## Risk & reversibility

False suggestions are possible because recorded history may be incomplete or unusual months may be legitimate. Fixed thresholds deliberately provide an explainable triage aid; no claim of statistical calibration. Excluding sparse categories limits usefulness but avoids imputing missing records as zero. Cent validation can expose previously malformed legacy rows without repairing them. Global mutation suppression may temporarily block review during unrelated financial saves; this is preferable to new optimistic-confirmation infrastructure in this batch.

Blast radius is read-only expense presentation and in-memory derived values. No saved record or payload changes. Revert this isolated source/test/docs batch through an ordinary Git revert and remove the composition/export; no database rollback or migration is needed. Preserve source logs and drafts. No force push or worktree deletion.

## Open questions and review decisions

- [x] Parent contract review: accepted the proposed three-month median, two-times and SGD50 heuristic on 2026-10-11 under the recorded roadmap/UX delegation. This is an explainable household rule, not statistical evidence or advice.
- [x] Integrate the local129 privacy source before consumer verification: current preparation base is602a4030403080d1f8de6594978f89ea58b9d956. Release gates and required exact-head CI remain separate.
- [ ] Decide implementation scheduling after 129 verification; only one heavy local verification job at a time.

No new owner dependency, migration, crypto or protected-file approval is needed for the proposed paths. Existing roadmap UX delegation allows ordinary review details to be resolved by the parent within this concrete proposal; do not fabricate approval in frontmatter.

## Initial preparation results

Read-only investigation and this draft only. No executable edits, package installation, tests, builds, browsers, commits or publishing. Complete-history source contract was inspected, not tested against production. Parent review and integrated implementation/verification remain outstanding.

## Prospective pure implementation decision — 2026-10-11

The parent reviewed this concrete contract and selected the transparent fixed heuristic: at least twice the preceding three-month median and at least SGD50 excess. Under approved081 AB, delegated routine UX decisions and Clarence's explicit parallel continuation, the parent instructed implementation of the pure builder, constants/result types and meaningful unit-test source in this isolated worktree. This is recorded ordinary roadmap authorization, not an agent setting a separate owner-approved frontmatter date. The document remains draft until the integrated feature's approval/delivery record is resolved.

This batch edits only src/features/expenses/lib/expense-anomalies.ts, src/features/expenses/constants.ts, test/features/expenses/expense-anomalies.test.ts and this prospective record. Named exported result/source types live beside the builder in expense-anomalies.ts; no additional types file or public barrel edit is required before the UI consumer exists. Existing actions, schemas, hooks, encryption and source histories remain unchanged. No UI/privacy integration, heavy jobs, package installation, commit or publishing in this preparation pass. Parent serial verification will run the new tests later.

The exact twice-baseline comparison avoids unsafe multiplication: for nonnegative safe integer current/median cents and a positive median, compare median with floor(current / 2), plus safe difference >=5000. This is exactly equivalent to current >=2×median without forming an overflowing intermediate. Date validation reuses the existing expense schema's date field; unknown/invalid dates block the whole analysis even outside its requested window because they cannot be located safely. Validly dated out-of-window financial values do not participate.

## Pure source preparation results — 2026-10-11

Implemented the pure builder/result types and named constants, with meaningful unit-test source. This source preparation leaves existing actions, schemas, hooks and financial records unchanged. Tests are authored but not run; no runtime, type-gate, production or security verification is claimed. UI composition, query/mutation readiness, Singapore clock acquisition, 129 privacy integration, consumer tests/browser evidence, independent review and full gates remain outstanding. No install, build, browser, commit or push occurred.

## Prospective UI implementation - 2026-10-12

The parent instructed continuation of the authorized130 UI after pure130/131 checks. Edit only the already selected expense-anomaly-review component/test, expense components barrel, expenses page composition and this spec. Extend the selected constants file to fixed availability messages as well as thresholds/page sizes, keeping static copy outside components. Reuse the existing privacy barrel after parent integration; do not copy or invent a separate provider in this baseline. UI imports may remain unresolved until129 is integrated, so do not claim full local gates here. Use existing expense query and useIsMutating, explicit Review and immutable derived source snapshot. Observed data/month/readiness/hide-epoch transitions invalidate saved results before rendering. No actions, schemas, encryption, dependency, migration or protected edits. Parent owns serialized verification and publishing.

Independent UI review correction before edits: integer cents must stay exact in display. A safe total9007199254740991 becomes90071992547409.9 after division into a floating currency unit. Use a component-local exact-cent formatter with BigInt constructors and separate whole/remainder formatting for totals, excess, baselines and source shares; preserve global formatters. Add a meaningful high-value UI regression in the existing selected consumer test. This synthetic arithmetic observation is not a financial record or runtime gate claim.

## Local integration preparation — 2026-10-12

Retained all130 preparation in named stash `retained-130-before-129-integration-2026-10-12` (`c6c5dd46664ab5ab1f9904ee1e786d5b766465d0`); do not drop it. Normally fast-forwarded this branch to local129 commit `47c0442577ec017aa66d838a3385d6c3e62c4554`, then reapplied that exact stash without conflicts. The existing privacy barrel is now present. Shipped PDF review remains composed by ExpenseTable;130 page edits only add its own disclosure above Quick Add. Existing129 masked inputs, source review and resource handling remain unchanged.

README now describes the explicit fixed heuristic, full-history/readiness boundaries, unavailable missing/zero/invalid history, exact personal-share cents and fresh-review requirement after Hide. This records integrated source preparation and a clean whitespace check, not full UI/gate/build/browser verification. Parent owns serialized tests, independent review and exact-head CI release. No packages, heavy jobs, commit, push or stash deletion were performed for integration.

## Final129 source integration preparation — 2026-10-12

Preserved exactly the nine known130 paths in retained stash `retained-130-before-129-final-602a403-2026-10-12` (`8cfbd5f2a51acfab59a232f678798800f9937042`): README, expenses page, expense components barrel/constants, this spec, pure builder, review component and their two tests. Normally fast-forwarded from47c0442 to `602a4030403080d1f8de6594978f89ea58b9d956`, then applied that exact stash without conflicts. Keep both130 retained stashes; neither was dropped. Current130 source base is the locally checked129 follow-up, not yet a claim of merged release/green CI.

The selected130 page adds only its disclosure. StatementReview remains composed by the existing ExpenseTable; privacy provider, native field/submit guards and finite zero-cell concealment remain inherited unchanged from602a403. Consumer tests now use the actual AmountVisibilityToggle and include deterministic UTC/Singapore month rollover and initial loading. Those tests are authored source, not a claimed pass. This preparation did not run tests, builds, browser jobs or installs, and did not commit or push. Parent owns the serial release verification queue.

## Final scoped verification before publication — 2026-10-12

TypeScript and two targeted files / 43 tests passed, including the actual visibility toggle, Singapore month boundary, initial loading, source invalidation and exact maximum-safe cent display. Independent review found no remaining actionable scoped findings after precision and label corrections.

Native source-matched synthetic Next checks at desktop 1440 × 900 and mobile 390 × 844 verified explicit September review (120 selected, 50 median, 70 excess), qualifying month totals and source provenance, missing history distinctions, current-month rejection, disclosure keyboard access, and Hide/Show invalidation requiring a fresh review. Page width remained 390 at the mobile viewport. The preview uses fixed-memory records, actions and identity; no real records, credentials, cookies or PIN were used. No private authentication, RLS, cryptography, database completeness or financial-advice proof is claimed.

Normal hooks, full coverage/build and exact-head hosted CI/merge remain pending; 130 is not shipped yet.
