---
id: 112
slug: year-zero-months
area: fix
status: draft
author: Codex
created: 2026-10-10
approved:
shipped:
impl_pr:
constitution_satisfies:
  - '§2.1'
  - '§2.3'
  - '§2.6'
  - '§3.1'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§5.1'
  - '§7.4'
constitution_overrides: []
---

# 112: Calendar-boundary display resilience and quarter spending precision

## Problem

The shared `YYYY_MM` schema accepts `0000-01`, but actual salary/assets chart
formatting with date-fns `yyyy-MM` throws `RangeError` for that month. An invalid
record can therefore prevent the page displaying otherwise accessible history.
Changing the shared schema to reject year zero is not a complete safe fix: the
same schema validates legacy snapshot reads, original IDs, deletion and encrypted
scenario metadata. Salary has one create/edit upsert, so new-key rejection also
rejects amount edits to existing year-zero records unless the contract separates
those operations.

Root accepted the bounded chart read-resilience scope and the exact quarter-end precision addendum under existing owner-authorized ordinary §7.4 remediation on 2026-10-10. PR37 merged before implementation. Root accepted combined external draft SHA256 `4bfad856dbde32caaa3d0c5d9b5ea048e1a13c67472c53413254c7a3048abfcd` and authorized this ordinary ten-path batch on 2026-10-10. Branch `impl/112-year-zero-months` starts from merged main `349bf026da12980eb62a99274d4221d8ccfe6727`. This repository scope is published before product/test edits. The combined batch restores truthful calendar-derived labels and quarter spending without altering any stored key or mutation contract.
New-write boundary rejection remains separately designed below; do not claim the
first batch solves it or requires a migration.

## Authorization history and immutable preparation evidence

Retain the planned record filename `specs/fix/112-year-zero-months.md`, blank feature-approval/shipped/impl_pr metadata and historical evidence. Root's ordinary §7.4 acceptance does not self-approve a feature, dependency, SQL or protected change. Original external six-path proposal remains unchanged: `112-year-zero-months-proposal.md` SHA256 `a9bad50820edf435aa39c85cbae0c0d5c5b5ebe0402ecf9e9c9a87558b000997`. Root separately read and accepted `112-quarter-end-precision-addendum.md` SHA256 `6817ded11839ac104bc87eee3c44d3978b68b643e576b221095fd8ee83299073` as a coherent addition after 111 merges. This combined external record preserves those historical contracts/evidence while making the final eight-path scope explicit.

Two linked ordinary closeout paths are authorized before edits, ten paths total: `specs/fix/111-equity-calendar-dates.md` (shipped/current delivery metadata only) and `docs/audit/2026-10-09-roadmap-progress.md` (exact PR37 delivery and linked112 scope). PR37 merged exact head `0f2a22533d2c3eff792a544a5479363ebf6f2c3b` as `349bf026da12980eb62a99274d4221d8ccfe6727` at 2026-10-10T16:25:47Z after required CI 38067279606 completed successfully at 16:24:35Z and Vercel preview success. Root verified public merged-commit production deployment success, not private workflow behavior. No unrelated delivery record or approval rewrite.

## Constitution check

Preserve financial payload encryption, identity/vault guards and RLS (§2.1/§2.3/
§5.1); no DB/schema/data change. Reuse existing date-fns without dependencies
(§3.1), retain feature ownership/public imports (§2.6), record paths before any
ordinary §7.4 implementation and require meaningful regressions/full gates and
review (§4.1/§4.2/§4.4). No override or protected file edit is proposed.

## Consumer inventory and evidence

Read merged source `c8714072d1ccd2b5630646439cf7a200bd511fbd`, with actual-source
synthetic reproduction using the preserved ordinary baseline at
`ee6e001957f1bb62a2e64479c00765cfc7e32396`. Relevant month contracts are unchanged
by108. Reproduction artifacts: `112-month-compatibility-reproduction.cjs` and
`.json`, containing generated keys/values only, inert guard/decryption/database
spies and pure date-fns/schema/export calls. No real database or record was read.

| Consumer                                                                        | Existing behavior and compatibility consequence                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/zod-utils.ts:3–5`                                                      | Four digits plus strict01–12; year0000 accepted. No minimum historical year/future ban.                                                                                                                                                                                        |
| `salary/schemas.ts:5`, `salary/actions/salary-actions.ts:59–78`                 | Upsert validates the shared month then writes text; one API represents both new and edited records.                                                                                                                                                                            |
| `salary/actions/salary-actions.ts:36–55`, `:84–97`                              | Read/delete query raw owner month. Synthetic actual calls accept legacy0000-01.                                                                                                                                                                                                |
| `salary/components/salary-form.tsx:49–63`, `:117–125`                           | Existing record ID is restored, month control disabled on edit. Tightened shared write schema would reject those edits. Native control may display a blank for0000, so mounted compatibility needs qualification before claiming editor usability.                             |
| `assets/schemas.ts:13`, `:28`, `:67`                                            | Same shared schema validates snapshot input, edit-read result and scenario source metadata. Global change can fail reads/decryption qualification.                                                                                                                             |
| `assets/actions/snapshot-actions.ts:99`, `:130`, `:153`, `:170`                 | Read month, edit original month, destination and delete month. Synthetic read/delete dispatch keeps0000-01. CAS binds identity/revision independently of month.                                                                                                                |
| `assets/hooks/use-snapshot-editor.ts:66`, `:88–108`, `:126–149`                 | Form resolver uses snapshot schema; read establishes original key/identity/revision. Changing the global schema can stop opening/editing legacy source before any repair choice.                                                                                               |
| `assets/components/snapshot-form.tsx:94–106`                                    | Editable native month control; moving an existing legacy snapshot to a valid month can reuse existing identity-bound CAS. Must show original raw legacy key rather than silently selecting a replacement.                                                                      |
| `assets/components/snapshot-table.tsx:79–158`, `:223–239`, `:265–284`           | Table uses raw month and complete values; edit links and compare-delete keep raw ID. No date-fns parsing here.                                                                                                                                                                 |
| `salary/components/salary-table.tsx:25–71`, `:119–133`                          | Raw month, displayed salary/bonus, raw-ID edit/delete. No date-fns formatting crash.                                                                                                                                                                                           |
| `assets/hooks/use-chart-data.ts:39`                                             | `format(parse(id,'yyyy-MM',new Date()),'MMM yyyy')` throws for0000-01. Existing last12 slice is a view limit, not data deletion.                                                                                                                                               |
| `salary/components/salary-chart.tsx:64`                                         | Same parse/format failure; cumulative values would otherwise retain all records.                                                                                                                                                                                               |
| `assets/lib/calculations.ts:22–37`, `components/summary-cards.tsx:58–92`        | Latest/previous are sorted-history positions, not calendar parsing. Amounts and raw key hints survive; do not rewrite totals or infer an elapsed/current month.                                                                                                                |
| `assets/components/salary-planner.tsx:105–116`                                  | Takes latest recorded salary amount; no date parse. A year-zero record alone can still supply entered planning values. New read filtering would change financial assumptions, so do not filter it silently.                                                                    |
| `salary/hooks/use-salary-ytd-stats.ts:45–56`, `lib/cpf-estimate.ts:49–68`       | Current-year records exclude0000; unsupported CPF years return unavailable. Do not invent historical CPF data or change inclusion policy.                                                                                                                                      |
| `assets/actions/scenario-actions.ts:67–85` and `schemas.ts:67`                  | Reads decrypt and qualify entire payload; invalidating sourceSnapshotMonth globally can make a legacy scenario unavailable and consequently block complete export. Source metadata is not the scenario row identity.                                                           |
| `assets/components/planning-scenarios.tsx:53–54`, `scenario-dialog.tsx:222–223` | Captures/displays original snapshot source month. Do not mutate or drop old metadata merely to pass a new schema.                                                                                                                                                              |
| `profile/hooks/use-export-data.ts:63–91`, `profile/lib/export-data.ts:40–49`    | Existing export preserves snapshot/salary month keys and all data; actual pure envelope/serialization reproduction retains0000-01. Must not silently normalize or omit them. Export is still not a restore proof.                                                              |
| `search/lib/record-search.ts:57–91`                                             | Matches/displays raw IDs; snapshot link uses exact encoded ID. No formatter crash.                                                                                                                                                                                             |
| `review/lib/monthly-review.ts:12–18`, `review/components/monthly-review.tsx:32` | Uses shared schema, exact-month records and previous-period arithmetic; global changes affect selection. Year-zero chronology is not established. Adjacent low positive years lose zero padding in prior-month arithmetic, a separate residual requiring evidence if selected. |
| Existing snapshot RPC SQL                                                       | Month regex also permits0000 and text columns retain it. Application-only validation cannot claim direct SQL prevention. No SQL was run or changed.                                                                                                                            |

Actual installed schemas accept year0000 and the chart expression throws.
Positive controls0001-01,0099-12,0100-01,0999-12,1000-01 and9999-12 all parse and
format without failure. There is no evidence supporting a new lower bound such
as1900 or a blanket ban on future years.

## Solution shape: bounded combined batch

Preserve `YYYY_MM`, actions, record arrays, routes, edit/delete IDs, scenario schema
and export exactly. Add a small shared month-label formatter that formats existing
supported positive calendar months normally and returns the unchanged raw key
with explicit `(invalid month)` qualification when unsupported. It never mutates,
filters, normalizes, sorts or silently repairs records. Use it only in the two
crashing chart expressions. Both charts retain amounts/cumulative values and
existing view limits; an invalid calendar point is visibly qualified, not presented
as a known valid date. Raw keys remain the chart IDs and action targets.

Exact eight paths accepted by root for this ordinary batch, to record before implementation:

1. `specs/fix/112-year-zero-months.md`: scoped ordinary remediation record.
2. `src/lib/utils/month.ts`: named `formatRecordedMonth` helper, no feature imports.
3. `src/features/assets/hooks/use-chart-data.ts`: replace only unsafe label expression.
4. `src/features/salary/components/salary-chart.tsx`: replace only unsafe label expression.
5. `test/features/month-record-compatibility.test.tsx`: actual helper/hook/chart
   regressions and original-key/value/array preservation; actual-action/export
   compatibility controls with inert synthetic boundaries where needed.
6. `README.md`: durable legacy-month display qualification, explicit limits of input prevention and unchanged history/access/export; local inclusive quarter spending precision.
7. `src/features/assets/lib/investment-math.ts`: only add explicit999 milliseconds to the existing inclusive local quarter-end constructor; retain return shape/comparator and all other financial math.
8. `test/features/assets/investment-math.test.ts`: actual helper quarter-start/end/year-turn/buy/sell/native-market controls.

This is chart read resilience plus bounded quarter-end precision, not new-write rejection or a complete financial
date-policy repair. Root has accepted this truthful ordinary scope; implementation is now authorized after PR37 merged and this batch was recorded.
If the UX requires visible page-level warnings beyond qualified chart labels,
record the additional exact component paths before editing rather than silently
expanding this eight-file batch.

### Quarter-end precision: exact inclusive constructor correction

Actual `assets/lib/investment-math.ts:51–64` builds local quarter end at23:59:59.000; `:107–124` intentionally counts buy costs in inclusive `[qStart,qEnd]`. Full timestamps in the final999ms are accepted by the actual trade schema but wrongly excluded from quarter spending. Existing tests check midquarter spending/end month, not millisecond boundaries. Sole runtime consumer `assets/components/investment-breakdown.tsx:95–106` passes those bounds to spending, then publishes/render budgets (`:133–179,185–207`); `market-deployment-card.tsx:53–75,130–135` displays spent/remaining. No consumer/product API edit is needed.

Exact product scope: `getCurrentQuarter` constructs end with the existing local year/month/day/hour/minute/second values and an explicit millisecond argument999. Keep `start`, `end`, `label`, `daysLeft` return shape, inclusive `computeQuarterSpend` comparator, buy-only policy, shares×price+fees, native SG/US sums, FX/readiness qualification and budget formulas. Do not introduce a nextQuarter/half-open API, UTC quarter, fixed Singapore-global policy, timer, new helper or financial aggregation cleanup.

Actual-source generated proof: `112-quarter-end-precision-proof.cjs` SHA256 `7d597e9864a546e6a255143b140918f8425d17d636619aad9f88dff67d86da77`, `.json` SHA256 `0acced885ee893ad9aac73066e877b44e5370dd3b663100a1a5cab9c944556d8`. Helper source SHA256 `7cd38d947b9749191a0a2632258b1e4426311a17623ccfdc076f8946fb4deef8`. Generated Singapore/UTC/NewYork profiles each reproduce missing .500/.999 buys and Dec31 .999 buys; exact start, prestart, end.000, nextquarter/yearstart and sells are controls. No secret environment values were read; test profiles explicitly assign synthetic process TZ values.

Passing proposed inclusive end+999ms into the unchanged actual spend helper makes all27 generated boundary cases match expected results. This is external proposed-bound evidence, not an implemented-source/gate claim. Passing next-quarter midnight as the end with the existing inclusive comparator incorrectly includes next-quarter spend; half-open semantics would require a wider contract and are not selected.

Native SG/US/fees controls and actual valuation/missing-FX/wrong-quote-currency controls remain intact. No currency policy changes. Preserve the existing daysLeft elapsed-millisecond Math.ceil formula and DST semantics: adding999ms may move the exact whole-day rounding threshold by less than a second. Do not describe this as a calendar-day countdown redesign. Existing date-only timestamp interpretation remains unchanged.

### Source inventory and implementation boundaries

Shared month-label helper owns display qualification without feature imports; the existing assets chart hook and salary chart own their respective raw-ID/amount projections. The new compatibility test exercises actual helper/hook/chart and retains original arrays/keys. Existing investment helper and its existing test own local quarter bounds/spending; they require no action/hook/dependency or database change. README and this ordinary record describe the exact bounded behavior and limits. These eight paths are a coherent calendar-derived display/calculation correction; framework/generated files, historical migrations and protected governance files remain read-only.

Review README/inline comments per batch. Keep non-obvious calendar qualification/inclusive local interval rationale and tooling directives; remove only stale in-scope narration. Do not change raw keys, table/edit/delete links, encrypted scenarios/export, action guards, read pagination, optimistic mutation/cache ownership, quote/FX availability, dependencies, permissions or stored values. Current-source integration after 111 must be reviewed before editing; preserve111's separately shipped validation without extending it here.

## Separate residual: previous-month low-year padding

Keep [112-monthly-review-low-year-residual.md](C:/Users/Clarence/.codex/visualizations/2026/10/07/01a1176f-ee87-7f10-8a3d-7b236296ca79/112-monthly-review-low-year-residual.md), SHA256 `a41aa642303fae2acabe075ca6ccb4520669f5f599bed376868cc4df1bb00bd9`, as separate historical read-only evidence. The actual monthly-review previous-period interpolation loses year padding for0001-02/0100-01/1000-01, failing to match supplied0001-01/0099-12/0999-12 snapshots; contemporary2026 control is unaffected. This is not repaired or certified by112's label formatter or quarter constructor. `src/features/review/lib/monthly-review.ts` and its tests are explicitly outside these eight paths. The boundary before0001-01 requires separately reviewed unavailable handling, not invented year-zero chronology. No new lower-year restriction or scope expansion is authorized here.

Final external drafting/check date:2026-10-11. Original preparation and root ordinary-scope acceptance history remain recorded above; the repository scope was recorded after PR37 merged, before implementation.

## Safe new-write boundary follow-up choices

**Never tighten `YYYY_MM` globally.** Separate positive destination/create month
validation from legacy lookup/original-ID/decrypted-metadata validation.

Snapshots already have an identity-bound edit contract. A future application batch
can reject new year-zero destinations while allowing reads/deletes and same-key
legacy edits bound to the original ID, immutable snapshot ID and expected revision;
explicit moves from legacy0000 to a user-chosen valid month can use existing CAS.
Its client resolver must understand that edit context instead of globally rejecting
the captured old key. Show original legacy ID visibly and preserve conflict/draft
behavior. Neither deletion nor repair may be automatic. No SQL change is inherently
needed for that application distinction, but direct RPCs still accept0000.

Salary's existing single upsert cannot distinguish a create from an amount edit
using only the submitted key. Two possible follow-ups require root selection:

- Prefer implementing month-create/edit distinction alongside separately approved
  salary revision contract109 if the owner approves it. Keep legacy lookup keys,
  revision IDs and existing amount edits explicit; reject new zero-year keys.
  This proposal does not approve109's migration or a production repair.
- A separate ordinary application-only branch could treat zero-year inputs as
  **existing-row update only**, after authenticated/vault context, and require
  an affected owned row before claiming success. Never use upsert/create in that
  branch, never recreate after deletion, and retain opaque failure/conflict.
  This adds a guarded mutation contract and needs its own exact path/test review;
  it does not solve ordinary lost updates or provide new CAS/idempotency. Do not
  implement a preceding existence check followed by upsert: deletion between
  those operations can recreate the invalid key.

Rejecting legacy salary edits without a supported explicit correction path would
strand data and is not accepted. Moving a salary month safely is not an existing
amount-only edit operation; preserve edit/delete/export and record that limitation.
Any automatic historical repair or new DB month constraint/RPC guard requires
concrete scoped owner migration approval and proof of preserving existing history.

## Out of scope

New month writes, year-range policy, future/YTD semantics, prior-month arithmetic,
quarter timezone policy changes, half-open API changes, daysLeft calendar-day redesign,111 equity date validation, paid/ex-date semantics, revision SQL,
legacy data repair, scenario protocol changes and global metadata rejection. No
dependency, protected file, cryptography, schema, credentials or production access.

## Acceptance for the combined batch

- [x] After 111 merged, the exact ten-path audit scope was recorded before edits and only tracked nonsecret source synchronized into the isolated fixture.
- [x] Actual baseline hook/chart tests fail with0000-01, corrected versions show
      `0000-01 (invalid month)` and retain every supplied amount/cumulative value.
- [x] Positive0001..9999 representative controls keep existing labels/IDs; malformed
      synthetic legacy keys cannot throw or be turned into another date.
- [x] Original arrays are unchanged; no new read filtering/query/action is added.
- [x] Existing raw-ID history/edit/delete links, actual read/delete boundary calls
      and export projection remain compatible. Do not claim mounted legacy editor
      save usability unless its native input behavior is exercised meaningfully.
- [x] Existing encrypted scenario with source0000 remains readable/exportable under
      the old schema; no new timestamp or source-month rejection.
- [x] Additional browser/layout proof was not selected for this bounded batch; future integrated synthetic page proof will examine chart rendering
      plus accessible raw-ID view/edit/delete navigation; memory adapters only and
      no private/authenticated-production claim. Verify keyboard/mobile fallback
      label readability, with Impeccable guidance within existing UI if useful.
- [x] All five gates and normal hooks pass in isolated synthetic fixture, every
      aggregate metric above80% and stricter security floors unchanged.
- [x] Independent resulting-code/README review; record qualified residual
      new-write/direct-SQL and repair limitations, no complete boundary claim.

- [x] Baseline actual quarter helper/spend regression is red for final .500/.999 buys and Dec31 .999. Corrected constructor returns end.getMilliseconds()999 and includes the final millisecond, while exact start/end.000 controls pass and prestart/nextquarter/yearstart/sells remain excluded.
- [x] Generated Singapore/UTC/NewYork local-policy controls preserve quarter labels/start and native SG/US cost+fees; existing valuation/FX and budget tests remain intact. No half-open bound or global timezone policy is introduced. Preserve daysLeft's elapsed ceil behavior and record its tiny threshold risk.
- [x] Verify helper and budget projection behavior with generated trades where practical without new product testability props or component paths. No private data/production query is needed; do not claim full investment-page/currency correctness from helper controls alone.
- [x] Independent fresh resulting-code/test/README review; exact scoped source/fixture hashes and all normal gates/hooks/CI are required. No merge approval before those delivery checks.

## Risk & reversibility

Blast radius is chart labels and the final999ms of local quarter spending inclusion only. An invalid key
is shown verbatim with qualification; React text rendering escapes it. Amounts,
history identity, navigation and encryption stay unchanged. Revert the scoped
helper/call sites/quarter-end constructor/docs/tests; no SQL, migration rollback or stored data deletion.
Do not conceal the invalid key or imply correction, verified chronology or backup
restoration. Later boundary changes need their own read/edit/repair compatibility
proof before delivery.

## Open questions and results

Root accepted the eight-path chart read-resilience and exact inclusive-end precision batch for implementation after 111 merges. Root/owner separately own109 and any DB/history repair decisions. Implementation evidence is recorded below; no new-write policy is selected for 112. Source/action-spy/
export reproduction ran with fixed generated data; no browser, real auth, database,
production, implementation gate, commit or PR proof is claimed.

## Risk, rollback and implementation record supplement

The quarter correction can unintentionally alter timezone/interval/budget/currency semantics if broadened; bound it to the existing constructor's999ms argument and meaningful existing-suite tests. Revert the ordinary scoped implementation normally if necessary, then run applicable gates/green CI; no destructive SQL, data repair, hard reset, force push or hook bypass. Preserve immutable preparation evidence and historical approvals even on rollback.

Root coordinates the heavy slot and delivery. Require `pnpm format:check`, `pnpm lint` with zero warnings, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`, every aggregate metric above80% and existing stricter floors unchanged. Full tests/build, normal hooks and exact-head CI/deployment are future implementation evidence, not supplied by this external draft. No 112 final browser, database or production verification is claimed; actual implementation evidence follows below. Mark shipped only after its actual merge and record exact head/PR/checks and residual new-write/repair policies. The owner's final integrated project sweep remains separately outstanding.

## Implementation record

Ten-path scope published before application or regression edits. Preserve original preparation evidence; final application tests/gates/review and112 delivery are not claimed yet. Chart tests prove qualified labels and amounts passed to Recharts, whose axes may skip or clip labels; they do not prove all labels are always visible at every width. Existing raw-key tables remain accessible.

### Scoped baseline and corrected proof

The initial baseline log (`112-baseline-red.log`) contained 13 meaningful calendar failures, 14 passing controls and one unrelated inert mock failure: async mocked decryption produced NaN. That mock was corrected to match the synchronous API and is not counted as product evidence. Seven cases demonstrate crashing or mislabelled chart data; six spending cases demonstrate missing final-millisecond SG/US buys across generated Singapore, UTC and NewYork profiles. No missing-helper module import was used as a red. The corrected focused suite passed 81 tests across six files (`112-targeted.log`), including representative positive-year chart labels, retained raw arrays/amounts/cumulative values, actual legacy read/delete dispatch and actual scenario-read schema qualification with inert decryption, plus version3 export projection. These action mocks do not establish real encryption or database persistence. Existing mounted real chart interactions also passed.

Final targeted verification passed after refinements: 81 tests across six files (`112-targeted-final.log`), TypeScript (`112-typecheck-final.log`) and zero-warning scoped ESLint (`112-scoped-lint-final.log`). The jsdom directive is first, and every quarter profile asserts its independently expected UTC offset. Source is frozen; root and independent reviewer accepted the corrected evidence and scoped contracts. All five gates passed serially as recorded below. 112 remains unshipped pending normal delivery hooks and exact-head CI/merge. Chart adapter tests observe the data handed to Recharts, not guaranteed visibility of every auto-skipped/clipped axis label; separate integrated synthetic Next proof remains planned.

Impeccable clarify/craft-floor guidance was read for truthful, concise invalid-month qualification within the existing visual system. No new UI layout, route, disclosure or tooltip was introduced. In-scope comments were reviewed: removed the assets hook useMemo narration and retained a concise inclusive local-quarter contract.

The corrected partial shipped-consumer baseline (`112-baseline-qualified-red.log`) restores only the three shipped chart/quarter consumer files from merged `349bf026` for the final corrected regression fixture: 13 meaningful calendar failures and 30 passing controls. The new helper remains present for final-test imports; direct helper controls are not evidence that a shipped helper existed. No import failure is counted. `112-baseline-restoration-hashes.json` verifies exact byte restoration of all three corrected fixture source files; managed source was not changed during the baseline.

### Complete local gates and delivery boundary

All five gates passed sequentially with synthetic configuration: route checks, formatter, zero-warning lint and TypeScript (`112-full-check.log`), full coverage (`112-full-test-ci.log`) and normal Next.js 16.3.8 Turbopack build (`112-full-build.log`). Coverage passed 143 files/1,410 tests in 554.49s: 93.08% statements, 89.31% branches, 91.24% functions and 93.62% lines. Every existing stricter threshold passed unchanged. Both accepted source reviews refer to the same frozen executable/test hashes; only evidence/prose recording changed after verification.

Root and independent scenario reviewer closed the initial mock/accounting issue and the directive/TZ/comment refinements. External review report `112-independent-source-review.md` SHA256 `bc66e1e11d1d53307d8403cee35194ac1c6b52fa1613729859d968ddd2113098` retains the qualified review. Normal commit/push hooks and exact-head CI/merge follow; no shipped or production behavior is claimed for 112. New-write/direct-SQL policy, legacy native editor usability, monthly-review low-year arithmetic and integrated browser/restore proof remain separate.

Before staging, an external-fixture fidelity check detected a Next dev-generated AGENTS append and four stale already-shipped document copies. Root inspected the exact differences and authorized restoring only those five fixture copies from immutable349bf026, retaining original bytes/hashes in `112-fixture-fidelity-before/` and `112-fixture-fidelity-hashes.json`. This is external approved-source materialization, not a tracked rulebook amendment. All five restored files have zero actual content diff and are excluded from staging. Alternate-worktree/index stat markers persisted despite exact content equality; content/cached diffs are the authority. The six executable/test hashes remained unchanged. Scoped formatter checks passed; unchanged normal hooks verify the final fixture.
