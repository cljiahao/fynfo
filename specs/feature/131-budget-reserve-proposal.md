---
id: '131'
slug: budget-reserve-proposal
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
    '§1.2',
    '§2.1',
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

# Spec 131: Owner-entered budgets and annual reserve planning

## Problem

Monthly review shows recorded personal spending but cannot compare it with a limit the owner chooses. Annual costs also need a transparent calculation of an amount still to reserve, divided across a contribution count explicitly chosen by the owner. These figures must not imply a bank balance, forecast, completed month or financial advice.

## Authorization and constitution check

Approved roadmap081 batchS authorizes preparation of budgets, recorded spending and annual reserves. Clarence requested parallel feature worktrees on2026-10-11. This is a source-reviewed draft for parent review, not implementation approval. Approval fields remain blank. Only this draft is written on `impl/131-budget-reserve-proposal`, baseline `b7a3f09590dcfc7d10d07fa5299dc15053f356ef`.

Use existing React/Zod and feature barrels. Client rendering is justified by interactive owner inputs (§2.5); pages stay compositions. No dependency, migration, cryptographic protocol, server action or protected-file change is included. Existing vault lifetime, encrypted payloads and RLS remain unchanged. No private financial records, credentials or environment files were read.

## Existing contracts and reuse evidence

- `src/features/review/lib/monthly-review.ts` matches the exact `date.slice(0, 7)` recorded month, rounds each bill/share to cents, subtracts all other-person shares regardless of settlement, and returns null personal spending when shared shares exceed their bill. Expense count distinguishes absent records from recorded zero personal share. Every recorded category contributes; there is no completion certification or category budget calculation.
- `src/features/review/components/monthly-review.tsx` already owns the selected month, existing query status and derived review. Reuse those rather than adding another all-record query or ledger.
- `src/features/expenses/lib/split-amounts.ts` validates finite, nonnegative, safe-cent and non-overallocated shares. The existing review helper alone does not comprehensively reject malformed historic numeric values. Qualify contributing rows before presenting budget results; do not silently discard bad records.
- `src/features/expenses/schemas.ts` validates dates and positive expenses. Refunds, transfers and card repayments have no distinct recorded contract yet; roadmapI is separate. Comparisons honestly include every currently recorded expense category.
- `planner_settings` has explicit allocation preference columns, no budget/reserve amount columns. `src/features/assets/actions/planner-actions.ts` is not a generic encrypted financial store.
- Approved103's `personal_planning_scenarios` uses encrypted `allocation-flat-cpf-v1` payloads and salary-plan inputs, with ten scenario slots. It is not an approved budget model. Do not expand its discriminator or consume its slots for a different feature without a reviewed contract.

## Solution shape: viable first batch

Recommend a **session-only planning worksheet** in the existing Monthly review section, below essential recorded totals. A named optional disclosure, **Budget and annual reserve plan**, contains one overall monthly limit and one annual reserve calculation. It reuses the incumbent inputs, labels and simple result lists; no new dashboard, chart or card grid.

Monthly inputs/results:

- **Monthly spending limit (SGD)** is entered by the owner. Blank is unset; explicit zero is valid. No recommended amount, income percentage or automated advice.
- **Recorded spending · your share** comes from the exact selected month's review. No matching expenses means **Not recorded**, with remaining/over-limit results withheld. Recorded zero personal share is valid and comparable.
- Show **Remaining against recorded spending** or **Recorded spending above your limit**, calculated in integer cents. Neither figure is spendable cash or proof that all expenses were entered. Keep the incomplete-record qualification visible.

Annual reserve inputs/results:

- **Annual cost target (SGD)**, **Amount already reserved (SGD)** and **Remaining planned contributions** (whole number1–12) are explicit owner inputs. Do not infer a deadline, months left in the year, bank balance, income or payment schedule. The first batch needs no user-authored goal name.
- Still to reserve = max(target cents minus already-reserved cents,0). When covered, show **Target covered by the amount entered**. Preserve entered excess rather than silently clamping inputs.
- Planned contribution = ceil(still-to-reserve cents / chosen count). Adjust the final contribution down so the contributions sum exactly to the remaining target. Show the chosen count and final adjustment clearly. This is target arithmetic, not a transfer recommendation or forecast.
- A reserve plan does not alter recorded spending, monthly-limit arithmetic, salary planning, investment allocation or saved asset balances. State that no money is moved/reserved and an entered reserve may already be included in recorded assets.

Visible limitation: **Session only — inputs clear when you leave this page, lock your vault, switch accounts or reload.** No Save button. Hiding amounts preserves drafts. Changing the review month explicitly clears its monthly limit while preserving the independent reserve draft until the worksheet owner unmounts. Do not silently reuse one month's limit for another.

### Exact proposed implementation paths, before code

New:

- `src/features/review/components/budget-reserve-worksheet.tsx`: interactive worksheet accepting selected month, qualified recorded spending and availability; owns controlled drafts and disclosure.
- `src/features/review/lib/budget-reserve.ts`: pure input qualification and integer-cent budget/reserve calculation helpers, named exports, no fetch/side effects.
- `test/features/review/budget-reserve.test.ts`: arithmetic/source qualification tests.
- `test/features/review/budget-reserve-worksheet.test.tsx`: actual input, state, visibility and error regressions.

Existing:

- `src/features/review/components/monthly-review.tsx`: compose worksheet from existing month/query/review; qualify source data before budget comparison. No new fetch or changed income/asset-change contract.
- `src/features/expenses/index.ts`: expose `getSplitAllocationError` if needed; no cross-feature deep import.
- `test/features/review/monthly-review.test.tsx`: exact-month, availability and month-change integration.
- `README.md`, this spec and `docs/audit/2026-10-09-roadmap-progress.md`: final measured behavior and limitations.

Reuse `buildMonthlyReview` as-is for valid spending arithmetic. Any broader change to shipped historic-data handling needs a separately recorded bounded remediation. Record any additional exact path before editing. No database actions, migrations, routes, global formatters, planner/profile persistence, protected governance, CI or hooks are selected.

### Qualification and incomplete records

Planning amounts must be finite, nonnegative, at most two decimal places and safely representable in integer cents. Blank is not zero. Count must be a whole number1–12. Invalid, overflowing or fractional-cent inputs retain visible field errors and withhold derived output; never render NaN/Infinity.

Qualify selected-month contributing rows before comparison: valid calendar date, positive finite safe-cent gross amount, finite nonnegative safe-cent shared shares, safe summed cents and no overallocated shares. Reuse the existing split validator. Settlement does not change personal share. Invalid contributing data blocks the entire comparison with **Check expense amounts and shared splits** and an Expenses link; no partial total, clamping, silent omission or substituted zero.

Malformed dates that cannot reliably be assigned to a month block comparison with a data-check warning rather than disappearing from its inventory. A numeric-invalid row belonging to another valid month does not poison this month. Preserve the established recorded-month contract; do not invent timezone conversion.

Loaded records can still be incomplete. No existing schema proves all statements were entered. Empty means **Not recorded**, nonempty valid means **Recorded**, never **Complete**. Category limits and statement reconciliation remain separate.

### Privacy129 and identity boundary

This worktree baseline predates129. Implement against verified129 after parent review, using its public `useAmountVisibility`, `FinancialValue` and `AmountsHiddenNotice`; do not create another provider. Financial controls are blank/disabled while hidden without resetting state. Monetary output and contribution quantities are concealed, including DOM attributes, accessible names, tooltips and native inputs. Labels, errors and assumptions remain visible with a Show amounts action. Stable imperative visibility reads guard input handlers. No database mutation/export is initiated.

Worksheet ownership stays within the existing unlocked identity-scoped financial subtree. Verify clearing on lock/account invalidation, navigation and reload. No localStorage, query-string, cookies or server persistence. Presentation concealment is not access control or full identity concealment.

## Persistence choice and separately gated follow-up

**Recommended first batch:** the transparent session-only worksheet. Existing approved schema is sufficient because nothing is saved. It does not complete persistent budgets, recurring reserve schedules or household-shared plans.

**If saved limits/goals are required before rollout:** pause persistence and propose a separate scoped encrypted personal-budget/reserve migration. It needs user ownership/RLS, identity-then-vault actions, bounded versioned payloads, safe create/update/delete concurrency/retry behavior, export inclusion and owner-confirmed migration before callers ship. No RPC/table names or schema approval are invented here.103 is an architectural pattern, not authority for a new model. Household sharing additionally requires its membership/key contract review.

## Out of scope

Saved plans, category budgets, household pooling, automatic transfers, reminders, advice, income forecasts, statement certification, refund/transfer/card-repayment classification, bank sync, estimated missing expenses, salary-plan changes, new dependency/schema/crypto and protected-file edits. No export change because nothing is persisted.

## Acceptance

- [ ] Parent selects the bounded first batch and records session-only versus persisted choice before code; no self-approval.
- [ ] Exact selected month, established personal-share math, all categories/records, settlement independence and pagination independence verified.
- [ ] Empty versus recorded zero, pending/error, incomplete and invalid split/date/amount states remain distinct; missing data never becomes zero/completed.
- [ ] Blank versus explicit zero limit, over-limit arithmetic, fractional-cent rejection and overflow covered.
- [ ] Explicit reserve inputs; zero/covered targets, ceil/remainder and exact final sum tested; nothing inferred.
- [ ] Month change clears only monthly limit; Hide/Show preserves drafts, blocks financial input changes and removes numeric DOM/accessibility leakage.
- [ ] Existing query lifecycle reused; no new all-record fetch, duplicate ledger, mutation or persistence.
- [ ] Lock/account invalidation and navigation/reload reset session inputs with accurate visible disclosure.
- [ ] Synthetic desktop/mobile and keyboard proof; labels/errors/material assumptions remain visible and recovery accessible.
- [ ] Meaningful targeted tests, independent review, README/comments review, normal hooks, all local gates and exact-head greenCI before merge.
- [ ] Every aggregate metric above80% and stricter floors unchanged; one heavy verification job at a time.
- [ ] Scope/spec hash matches implementation PR; shipped metadata only after merge.

## Risk & reversibility

Risks: representing absent data as unused budget, using shared gross bills, implying an actual reserve balance, storing amounts in an unrelated schema, losing drafts during hiding or duplicating expensive reads. The first batch confines changes to presentation and pure arithmetic. Backout is an ordinary scoped revert; no database rollback.

## Open questions

- Parent/owner: accept session-only first batch or require persistence before rollout? Recommendation: transparent worksheet first, separate encrypted persistence approval if useful. No migration consent inferred.
- Parent: confirm verified129 integration base/public interface before code; reuse its provider.
- Owner only if later requested: personal versus household-shared saved plans. First batch is personal and makes no pooling claim.

## Investigation result

Source-only preparation complete. Monthly review provides reusable valid-record math with extra qualification at the comparison boundary. Existing planner/scenario tables do not provide the proposed persisted model. Only this draft was written: no application code, dependency, migration, install, test/build/browser job, commit or push.

## Bounded arithmetic implementation selection — 2026-10-11

The parent reviewed this proposal and selected the transparently session-only first batch under the owner's approved081S/072 ordinary feature/UX direction and explicit parallel continuation. This records that selection, not a new agent-granted approval; the frontmatter approval field stays blank. Before executable edits, the selected source scope is exactly `src/features/review/lib/budget-reserve.ts`, `src/features/expenses/index.ts` (public split-validator export) and `test/features/review/budget-reserve.test.ts`. UI integration remains pending the verified129 base. No persistence, migration, dependency, install, heavy verification, commit or push is authorized in this subtask.

Arithmetic clarification before code: when the remaining target is fewer cents than the chosen contribution count, ceiling-sized payments can cover it before the final slot. Contributions are capped at the remaining amount in each slot, with later slots explicitly zero, so no adjusted payment is negative and the schedule still sums exactly. The helper returns every planned slot for honest presentation. This does not forecast payment dates.

Independent review identified three corrections within the same selected paths: use BigInt constructors rather than literals for the incumbent ES2017 TypeScript target; take and validate exact integer personal cents from existing monthly-review contributing sources rather than converting its dollar total back to cents; reject unknown split types rather than treating them as self-paid. Add precise high-value and malformed-type regression cases. No UI, persistence or scope expansion is involved; parent runs serial verification after these corrections.

## Session-only UI scope — 2026-10-12

Parent directs the bounded owner-approved131 session-only UI under existing081/072 and explicit parallel continuation. Before UI edits, add exactly src/features/review/components/budget-reserve-worksheet.tsx, compose it in src/features/review/components/monthly-review.tsx, and add test/features/review/budget-reserve-worksheet.test.tsx. The worksheet stays mounted across query pending/error transitions; its own state remains above the disclosure. Month change clears only the monthly limit. Use129 public privacy APIs as an integration dependency, without copying or inventing a provider on this older baseline. UI remains frozen for parent review/rebase and serial verification; no persistence/dependency/schema/actions/commits/push or heavy jobs.

Parent serial verification before the new UI: pure130/131 tests passed75 tests across2 files (13033 +13142) and full `tsc --noEmit` passed in the pinned117 synthetic fixture, recorded in `work/130-131-pure-tests.log` and `work/130-131-pure-types.log`. These results do not cover the subsequently added UI, full gates or browser behavior. New worksheet rendering preserves exact cents in display without a dollar round-trip, gives neutral comparison labels while hidden, and retains draft ownership outside disclosure/query conditionals. Component-test source is prepared; actual129 integration/rebase, targeted execution and browser/full gates remain pending.

## Query-readiness correction scope — 2026-10-12

Independent review found cached refetch or pending optimistic mutations could be labelled recorded/ready by the new worksheet. Before correction, select exactly existing monthly-review.tsx plus new test/features/review/budget-reserve-integration.test.tsx. Conservatively use installed useIsMutating and expense isFetching to withhold only the new budget comparison while cached history/refetch or saves are unresolved; preserve existing monthly-review totals and broader query behavior. Keep worksheet mounted and retain all input drafts across readiness changes. No additional read, mutation, dependency or schema change; parent serial tests remain required.

## Actual129 integration — 2026-10-12

Preserved all unfinished131 changes in retained named stash `retained-131-before-129-integration-2026-10-12`. Fast-forwarded this isolated branch onto local129 commit `47c0442577ec017aa66d838a3385d6c3e62c4554`, then applied the131 stash without dropping it. Monthly-review auto-merge had no conflicts and retains129 monetary masking plus131 worksheet/query readiness composition. Actual129 public privacy APIs now exist on this base; no provider was copied or rewritten. README documents the session-only worksheet and recorded-data limitations. No131 commit/push, heavy verification or browser evidence is claimed by this integration.

## Final129 source integration — 2026-10-12

Preserved exactly the nine selected131 source/test/docs paths (README, expenses barrel, monthly-review composition, this spec, worksheet, arithmetic helper and three budget test files) in retained named stash retained-131-before-129-final-602a403-2026-10-12, hash11340555b6912be02c6bb8debdc3d3a9c5e9b44c. Normal fast-forward merge moved this branch to final local129 commit602a4030403080d1f8de6594978f89ea58b9d956. Applied that exact stash hash and retained it; no conflicts. Eight pre-integration131 files were byte-identical immediately after application. README differs only by integrated129's screen-sharing limitation line; scoped131 prose remains intact. This spec now adds the integration record. No131 commit, push, install or heavy check occurred. Parent reports129 targeted/native corrections and normal commit check passing, while its normal push is still active; this is not a131 UI/full-gate or exact-headCI claim.

## Measured verification — 2026-10-12

Own frozen offline dependency installation and TypeScript check passed. Three targeted files passed 51 tests: arithmetic, worksheet behavior and actual TanStack cached-refetch/pending-mutation integration. Logs are preserved in the parent work directory as 131-install.log, 131-types.log and 131-targeted.log.

Synthetic Next desktop and 390px mobile checks passed against hash-matched actual 129–131 components with fixed-memory fixture adapters. Explicit limits, over-limit comparison, fractional-cent errors, exact remainder schedule, Hide/Show draft retention, month-change ownership and navigation reset were checked. Worksheet edits added no writes after surrounding planner initialization settled. This is synthetic UI evidence, not private authentication, RLS, cryptographic or database proof. Details and images are retained in 130-131-browser-proof.txt and 131-budget-desktop.png / 131-budget-mobile.png.

Independent reviews found no remaining actionable issues in the selected scope. Normal publishing hooks, aggregate coverage, exact-head hosted CI and merge remain pending; no shipped status is claimed here.

## Feature130 composition — 2026-10-12

All nine selected131 paths were preserved in retained named stash retained-131-before-130-integration-2026-10-12. The branch fast-forwarded to reviewed local130 commit eb8b009, then applied the retained stash without conflicts. README contains both feature scopes. No behavior was changed during integration; final normal gates remain pending.
