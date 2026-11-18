---
id: '193'
slug: dividend-coverage-planner
area: feature
status: draft # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-19
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # no PR (direct to main), set on shipped
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§5.4'
  - '§6.3'
constitution_overrides: []
---

# Spec 193: Dividend coverage milestones, dividend-funded spending, planner insurance and CPF ceiling

Builds on spec 184 (freedom projection, shipped: it already shows a dividend coverage line), spec 179 (planner salary is recurring pay only) and spec 176/183 (planner settings storage).

## Problem

The owner's old budgeting notes had five income-allocation stages. Stages 1-3 (emergency nest, nest plus 30%, heavy investing) are already the planner's emergency-fund, war-chest, invest flow. Stages 4-5 ("dividends hit 1k per year, invest less and spend more", "dividends hit 1k per month") are not modelled: the app shows one rounded coverage percentage and nothing about milestones, what the next one needs, or how much dividend income may be spent rather than reinvested.

Two numbers in the planner also drift from the notes and from reality. Insurance is a hardcoded 5% of net pay, where the notes use 7%. Net pay is `salary * 0.8`, which ignores the CPF ordinary wage ceiling that the salary feature already implements, so a salary above the ceiling understates take-home and every downstream amount (investing, savings rate, freedom projection).

Dividends are a milestone-and-allowance display. Stages 1-3 stay as they are.

## Constitution check

- §1.1 and §5.1: personal-only. Nothing is written to household data and the partner never sees these figures. Household surfaces are untouched.
- §2.1: dividends, expenses and salary are encrypted payloads and are read only through the existing decrypting hooks (`useDividends`, expenses, salary). All new maths runs client-side on decrypted values. The new stored settings are percentages (insurance %, spend share %, threshold %), stored plaintext on `planner_settings` exactly like `tithe_pct` and spec 184's `freedom_*` columns; §2.1 does not list percentages as encrypted. No amount is stored.
- §5.4: no SQL filters or aggregates encrypted columns; the new columns are never queried.
- §6.3: one additive, idempotent migration (`ADD COLUMN IF NOT EXISTS`, CHECKs in a guarded DO block), modelled on `supabase/migrations/20261110000184_planner_freedom_assumptions.sql`. No data is rewritten unless the owner picks backfill in Q1.
- §2.2: the settings save through the existing `upsertPlannerSettings` server action. No new action or route. It already calls `requireUserId()` then `getVaultDekSession()` per §2.3; the pattern is unchanged.
- §2.4 and §2.6: pages stay thin. New code lives in `src/features/assets/` and is imported through the barrels; the salary CPF helper is added to the `@/features/salary` barrel (today `src/features/salary/index.ts` does not export `calculateMonthlyCpf` or `employeeCpf`) rather than deep-imported.
- §2.5: Server Components by default. Any new component is `'use client'` for the same reason as `SalaryPlanner` and `FreedomCard`: it reads client-only hooks (`useAmountVisibility`, TanStack Query).
- §3.1 and §3.2: no new dependency, no inline static data (milestones and defaults go in `constants.ts`), no `any`.
- §4.1 and §4.2: all gates, with tests for every pure branch (CPF, coverage, allowance).

No SOFT override is requested.

## Current behaviour (verified)

Planner math:

- `src/features/assets/lib/salary-plan.ts` `computeSalaryPlan` (:119-217). `netAfterCpf = salary * 0.8` (:139); `insurancePct = 0.05` (:142). Inputs `SalaryPlanInput` (:66-83), output `SalaryPlan` (:85-111, `insurancePct` and `insuranceAmt` already exist as output fields).
- `calcRecentAvgExpense(expenses, now, months = 12)` (:38-64) is the recent monthly average; insurance-type expenses are excluded from totals by `EXPENSE_TOTAL_EXCLUDED_TYPES` (`src/features/expenses/constants.ts:44-46`) because the planner models insurance as its own slice.
- `src/features/assets/components/salary-planner.tsx`: `DEFAULT_SETTINGS` (:126-134), `salary={latestSalary?.recurring ?? 0}` (:208; recurring pay only, spec 179, bonuses excluded), settings state seeded from `initialSettings` (:253-265) and an Insurance donut row from `plan.insuranceAmt` (:459-465). `planner-settings-sheet.tsx` and `planner-inputs.tsx` hold the settings controls.
- `PlannerSettingsData` (`src/features/assets/types.ts:52-`; tithe, allowance, `householdHorizonMonths?`, `expenseBufferPct?`, and spec 184's optional `freedom*` fields). Validated by `plannerSettingsSchema` (`src/features/assets/schemas.ts:38-`). Persisted by `src/features/assets/actions/planner-actions.ts` (`BASE_COLUMNS`/`BUFFER_COLUMNS`/`FREEDOM_COLUMNS` :11-16; optional groups omitted when undefined so autosave never resets them; a missing-column error drops the newest group and retries). Defaults for the two months values are in `src/features/assets/constants.ts:4-5`.
- Saved scenarios: `scenarioInputsSchema` is a strictObject with no insurance or CPF field (`schemas.ts:54-67`), and the payload `model` is the literal `'allocation-flat-cpf-v1'` (`schemas.ts:73`), re-run through `computeSalaryPlan` by `scenario-dialog.tsx` and `scenario-actions.ts`. Changing the defaults inside `computeSalaryPlan` would silently change every saved scenario.

CPF (reuse, do not duplicate):

- `src/features/salary/lib/cpf-estimate.ts`: `ordinaryWageCeiling(year, month)` (:9-16; 2023 changes in September, other years from `CPF_ORDINARY_WAGE_CEILINGS`, null if unknown), `employeeCpf(ordinary, additional, ceiling)` (:19-43; 20% of `min(ordinary, ceiling)`, the sub-SGD 750 phase-in, floored, null on invalid input).
- `src/features/salary/lib/tax-cpf.ts:73-90`: `getCpfMonthlyCeiling`, `getCpfAnnualCeiling`, `calculateMonthlyCpf(monthlySalary, year, month?)` (null for a year with no ceiling).
- `src/features/salary/constants.ts:33-41`: `CPF_EMPLOYEE_RATE = 0.2`, `CPF_ANNUAL_WAGE_CEILING = 102_000`, `CPF_ORDINARY_WAGE_CEILINGS` = 2023 6300, 2024 6800, 2025 7400, 2026 8000. Nothing after 2026.
- The model assumes age 55 and below at full rate (`cpf-estimate.ts:18`); the planner inherits that.

Dividends and an existing coverage figure (so 193 extends, not duplicates):

- `src/features/equity/lib/dividend-metrics.ts` `trailing12MonthSGD` (:70-80), `dividendSummary` (:94-), window (asOf - 1 year, asOf].
- `src/features/equity/lib/dividend-breakdown.ts`: `averageMonthlyTTM(ttm) = ttm / 12` (:88-90) and `expenseCoverage(avgMonthly, monthlyExpenses)` (:185-198; a fraction, null unless expenses is positive and finite).
- `src/features/assets/hooks/use-freedom-inputs.ts:163-176` `useDividendAvgMonthly()` returns the TTM monthly average in SGD, or null when dividends cannot be valued (no rows, or USD rows without a rate).
- Freedom projection already shows coverage: `freedom-projection.ts` `dividendCoverage` (:235-242) uses `expenseCoverage(dividendAvgMonthly, annualCost / 12)` and is rendered by `freedom-card.tsx:202-208` as "Dividend coverage N% of living cost" (rounded, no milestones, no gap). The denominator there is living cost `12 * (expenses + bufferAmt + budgetsMonthly)` (`use-freedom-inputs.ts:128-129`).
- The Investments tab `dividend-summary.tsx` shows a second coverage figure (:102-103) against `monthlyExpenses={plannerValues.expenses}` (`dashboard-overview.tsx`), i.e. expenses without buffer or household budgets. The two existing figures therefore already use different denominators (Q6).

UI placement: `dashboard-overview.tsx` has two views, Overview and Investments (`PageViews`, :113-). There is no tab called "Plan income"; the planner (`SalaryPlanner`) is a card on the Overview view, followed by `FreedomCard`.

## Solution shape

All maths is pure, in `src/features/assets/lib/`, with no I/O.

1. Dividend coverage and milestones (new `lib/dividend-coverage.ts`):
   - Constants in `constants.ts`: `DIVIDEND_COVERAGE_MILESTONES = [0.1, 0.25, 0.5, 1]` (fractions; see Q2).
   - `computeDividendCoverage({ ttmMonthlyAvg, monthlyExpenses }) -> { coverage: number | null; reached: number | null; next: number | null; gapTtmSgd: number | null }` where `ttmMonthlyAvg = trailing12MonthSGD / 12` (reuse `useDividendAvgMonthly`, so the 12 division is not repeated) and `coverage` comes from `expenseCoverage`. `reached` is the highest milestone with `coverage >= milestone`; `next` is the lowest not reached (null at 100% or above). `gapTtmSgd = max(0, next * monthlyExpenses - ttmMonthlyAvg) * 12`, the extra trailing-12-month dividends (SGD per year) still needed. Null whenever coverage is null (expenses not positive, or dividends not valued). Zero dividends with positive expenses gives coverage 0, reached null, next the first milestone.
   - Reuses `expenseCoverage` and the existing hook. The freedom card line is replaced by the milestone view (reached, next, gap) so there is one coverage figure on the Overview, not two (`FreedomInput.dividendAvgMonthly` and `dividendCoveragePct` stay; the card renders from the new function). Spec 184's other outputs are unchanged.
2. Dividend-funded spending allowance (same file):
   - `computeDividendAllowance({ ttmMonthlyAvg, coverage, thresholdPct, sharePct }) -> { monthlyAllowance: number; monthlyReinvest: number } | null`. When `coverage >= thresholdPct / 100`, `monthlyAllowance = ttmMonthlyAvg * sharePct / 100` and the rest is reinvested; below the threshold the allowance is 0 and everything is reinvested. Null when coverage is null.
   - Display only: "You may spend up to $X/month from dividends; the rest is reinvested". The salary split, `computeSalaryPlan` investing amount and the freedom projection's `monthlyInvesting` are not changed by milestones. No transactions, no goals and no household data are created or read.
3. Insurance as a planner setting:
   - `SalaryPlanInput.insurancePctInput?: number` (percent). When absent the function uses 5, so existing scenarios and every caller that does not opt in compute exactly as today.
   - `PlannerSettingsData.insurancePct?: number`, `plannerSettingsSchema` and the export validator gain the field (`min(0).max(100)` optional). `salary-planner.tsx` passes `insurancePctInput` into both `computeSalaryPlan` and the saved settings; the settings sheet gets one number field next to tithe and allowance.
   - New `planner_settings.insurance_pct NUMERIC` (NULL means "use the default", resolved in code from a `DEFAULT_INSURANCE_PCT` constant in `constants.ts`; see Q1).
4. CPF ordinary wage ceiling in the planner:
   - `SalaryPlanInput.employeeCpfMonthly?: number | null`. When a finite non-negative number is passed, `netAfterCpf = salary - employeeCpfMonthly`; when absent or null the function keeps `salary * 0.8` (legacy, used by saved scenarios, whose `model` literal `'allocation-flat-cpf-v1'` therefore keeps its meaning and `scenarioInputsSchema` is not changed).
   - `salary-planner.tsx` computes the figure with `calculateMonthlyCpf(salary, year, month)` for the current date (exported from the `@/features/salary` barrel in this spec; no CPF logic is copied). If the year has no ceiling the caller falls back to the newest year in `CPF_ORDINARY_WAGE_CEILINGS` (Q4); if the helper still returns null (invalid input) the planner uses the legacy 80%.
   - Annual wage ceiling and bonuses: the planner's gross is recurring monthly pay only (spec 179), so annual additional-wage rules do not apply. Recommended: apply only the monthly ordinary wage ceiling; document in a comment that the SGD 102,000 annual limit is not applied because at the current ceilings (8000 x 12 = 96,000 in 2026) recurring pay alone cannot reach it, and bonus CPF is outside the planner (Q5).
   - Knock-on effect, intended: higher `netAfterCpf` for salaries above the ceiling raises `investmentAmt`, `savingsAmt`, the freedom projection's `netMonthlyIncome` and savings rate (`use-freedom-inputs.ts:137`). Percent fields of `SalaryPlan` are fractions of the new net.
5. Persistence (investigated, answer: migration):
   - `PlannerSettingsData` is stored as plaintext columns on `planner_settings`, not in an encrypted blob, so three new columns need a migration `supabase/migrations/<ts>_planner_dividend_insurance.sql`: `insurance_pct NUMERIC` (CHECK 0-100), `dividend_spend_threshold_pct NUMERIC` (CHECK 0-100), `dividend_spend_share_pct NUMERIC` (CHECK 0-100); all NULLable, additive, idempotent; existing own-row RLS covers them (`20260411150000_init.sql`, RLS block near :136-140). `planner-actions.ts` gets one more column group with the same missing-column fallback and omit-when-undefined behaviour as spec 184. Defaults live in `constants.ts` and are applied when a column is NULL.
   - The export/import path: `src/features/profile/lib/export-validation.ts:131-142` is a strictObject for the planner and must accept the three new optional fields. At draft time it also appears to lack `expenseBufferPct`, which `getPlannerSettings` always returns (`planner-actions.ts:83`); the implementer verifies this and, if so, fixes it in the same change as a one-line drift note in the PR body (AGENTS.md section 7).
6. UI (recommended, Q7): the coverage milestones, gap and "may spend" line replace the single coverage line in `freedom-card.tsx:202-208` and the allowance settings (threshold and share) sit in the existing `planner-settings-sheet.tsx`. Every amount goes through `useAmountVisibility` masking. Copy states these are estimates from logged dividends, not advice (§1.2).

## Out of scope

- Any change to Stages 1-3, the emergency-fund / war-chest / invest ordering, or `computeSalaryPlan` slice ordering beyond the two inputs above.
- Automatic transactions, transfers, goals or reminders; the allowance is read-only text.
- Changing the salary split or the freedom projection's `monthlyInvesting` based on milestones.
- Household or partner surfaces, and sharing coverage with the partner.
- Bonus CPF, additional-wage ceiling, tax, age-banded CPF rates, and CPF balance projection.
- Rewriting the Investments tab `dividend-summary.tsx` coverage figure (its denominator question is Q6; any change is a follow-up).
- Forward or declared dividend estimates; only trailing-12-month received dividends are used.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` and `pnpm build` green.
- [ ] Unit tests, `lib/dividend-coverage.test.ts`: coverage = TTM / 12 / monthly expenses; zero expenses gives null coverage, no milestone and no gap; zero dividends gives coverage 0, next = 10% and gap = 10% of annual expenses; exactly on a milestone counts as reached; coverage at or above 100% gives next null and gap null; non-finite or negative inputs give null; null (unvalued) dividends give null.
- [ ] Unit tests, allowance: 0 below the threshold, `share` of TTM monthly average at and above it, share 0 and 100, remainder reinvested equals average minus allowance, null when coverage is null, never negative.
- [ ] Unit tests, `salary-plan.test.ts`: insurance input defaults to 5 when absent (legacy outputs byte-identical for existing fixtures); a 7 input changes `insurancePct`, `insuranceAmt` and `investmentPct` consistently; `employeeCpfMonthly` absent keeps `salary * 0.8`; present gives `salary - cpf`.
- [ ] Unit tests, CPF reuse: salary below, at and above the ordinary wage ceiling (2026: 7,999, 8,000, 12,000 gives 1,599 / 1,600 / 1,600 employee CPF); year boundary (2025-12 uses 7,400, 2026-01 uses 8,000; 2023-08 uses 6,000, 2023-09 uses 6,300); a year past the table falls back per Q4; salary 0 and sub-SGD 750 phase-in do not produce negative net.
- [ ] Scenario regression: an existing saved scenario payload recomputes to identical numbers; `scenarioInputsSchema` is unchanged.
- [ ] Persistence tests: `planner-actions` writes and reads the new columns, omits them when undefined, and still saves when the migration is not yet applied (missing-column fallback); export/import round-trips the new fields.
- [ ] Migration replayed on a fresh local DB; re-running it is a no-op.
- [ ] Manual: with sample data, the card shows current coverage, next milestone, gap and "may spend up to $X/month" that all change with the settings; values are masked when amounts are hidden.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: planner numbers and the freedom card on the owner's Overview. CPF-ceiling and (if 7%) insurance changes move existing plan amounts, savings rate and freedom projection dates for salaries above the ceiling or with default insurance. Scenarios are protected by keeping the legacy path when the new inputs are absent.
- **Reversibility**: code is a git revert. The migration only adds nullable columns; leaving them is harmless (forward-only, §6.3). No data is deleted.
- **Backout plan**: revert the commit(s); the app then ignores the extra columns. If the migration was applied nothing further is required.

## Open questions

- [ ] Q1: Insurance default, 5% today versus 7% in the notes. A 7% default shifts every existing plan's numbers (about 2% of net pay moves from investing to insurance) because stored rows have NULL. Options: (a) keep 5%, new setting only; (b) default 7% for everyone; (c) migration backfills existing rows to 5 and sets the UI default to 7 for new rows. Recommendation (c). — Owner: Clarence — A:
- [ ] Q2: Milestone thresholds. Proposed 10%, 25%, 50%, 100% of monthly expenses. Add a 75% step, or make them configurable? The old notes also had absolute stages ("SGD 1,000 per year", "SGD 1,000 per month"); keep percentages only? — Owner: Clarence — A:
- [ ] Q3: Spend-share rule and defaults. Proposed one threshold and one share: 0% of TTM dividends spendable below 25% coverage, 50% at or above it, both configurable (0-100). Alternatives: tiered shares per milestone; a share that ramps to 100% at full coverage. Should the allowance be per month of TTM average (proposed) or net of withholding tax? — Owner: Clarence — A:
- [ ] Q4: Ceiling table ends at 2026. For a later year the helper returns null. Proposed: fall back to the newest known ceiling and rely on a yearly constants update. Alternative: fall back to the legacy flat 80%. — Owner: Clarence — A:
- [ ] Q5: Annual wage ceiling (SGD 102,000) and bonuses. Proposed: monthly ordinary wage ceiling only, because the planner gross is recurring monthly pay (spec 179) and recurring pay alone stays under the annual limit at current ceilings; bonus CPF stays outside the planner. Confirm, or ask for a bonus-aware annual model (needs additional-wage input). Note a high earner's bonus CPF is not reflected in planner take-home. — Owner: Clarence — A:
- [ ] Q6: Coverage denominator. Freedom card uses living cost (expenses + buffer + household budgets); the Investments tab uses planner expenses only; the brief says planner expenses or recent average. Proposed: the freedom-card living-cost figure everywhere new, so "100% = dividends cover living cost", with the 12-month recent average (`calcRecentAvgExpense`) only as the input behind planner expenses when no override is set. Align the Investments tab figure too (follow-up), or leave it? — Owner: Clarence — A:
- [ ] Q7: Placement. There is no "Plan income" tab; the planner is a card on Overview. Proposed: replace the coverage line in the freedom card with the milestone row plus allowance line, with threshold and share in the planner settings sheet. Alternative: a standalone dividend coverage card beside `SalaryPlanner`, or a section in the planner results. — Owner: Clarence — A:
- [ ] Q8: Planner CPF currently models age 55 and below at the full rate only (as the salary feature does). Acceptable for the planner, or should age be a setting? Proposed: acceptable, state the assumption in the settings copy. — Owner: Clarence — A:
