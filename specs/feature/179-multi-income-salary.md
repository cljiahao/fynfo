---
id: '179'
slug: multi-income-salary
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-06
approved: 2026-11-06 # YYYY-MM-DD, set on approval
shipped: 2026-11-06 # YYYY-MM-DD, set on impl merge
impl_pr: 'direct to main: ac49352, 10a7d03, d357614, 2ff5fcc, a82fa19, d6867cc, 9d0c1c0' # no PR (direct to main), set on shipped
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§5.1'
  - '§5.2'
  - '§5.4'
  - '§6.3'
constitution_overrides:
---

# Spec 179: Multiple income lines per month

## Problem

Each month has exactly one salary row, `{ salary, bonus }`
(`salary_records`, `src/features/salary/schemas.ts`). The owner has several
income sources: more than one job, bonuses, and one-time payments such as
freelance work or ex-gratia. One row cannot hold these, so they get lumped into
one number. That distorts the monthly plan, the CPF and tax estimates, and the
"vs a year ago" comparison, and it hides when each salary changed. The owner
wants several typed income lines per month and a clear history of salary changes.

Scope is the owner's own income only. A partner's income stays in the partner's
own Fynfo account and is never entered here.

## Constitution check

- Satisfies: `§2.1` (labels and amounts are encrypted with `encryptPayload`),
  `§2.2` and `§2.3` (mutations are server actions that call `requireActionContext()`
  first), `§2.4` (pages compose features), `§2.6` and `§2.7` (barrel and named
  exports), `§3.1` and `§3.2` (no new dependency), `§4.1` and `§4.2` (gates and
  tests), `§5.1` (no DEK or PIN change), `§5.2` (new table ships with RLS in the
  same migration), `§5.4` (no SQL filter or sort on encrypted columns; the
  `type` and `month` columns are plaintext by design, see below), `§6.3`
  (additive, forward-only migration).
- Overrides: none.
- No `HARD` rule is touched. The plaintext `type` column reveals only that a
  month has a salary, bonus or one-time line, not any amount or label. It is
  the same class of metadata as the existing plaintext `month` column.

## Decisions (owner, 2026-11-06)

1. Line types: `salary` (recurring, at most one per employer per month), `bonus`
   (CPF Additional Wage), `one_time` (freelance, ex-gratia; no CPF). Each line
   has a free-text label (employer name, "AWS", ...), encrypted like amounts.
2. Planner gross is the sum of the latest month's `salary` lines. Bonus and
   one-time lines are excluded from the monthly plan and shown separately as a
   trailing-12-month figure.
3. CPF and tax are computed per employer. The OW ceiling applies to each
   employer's `salary` line separately, where employer is the label of the
   salary line. `bonus` lines are AW and are checked against the annual AW
   ceiling, which is computed on total OW for the year. `one_time` lines get no
   CPF. Taxable income still includes all lines.
4. The At a glance Salary card and "vs a year ago" use recurring (`salary`)
   lines only.

## Solution shape

Items marked "Proposal" are the author's design choices; the owner can change
them before approval.

### Data model (Proposal)

- New migration `supabase/migrations/20261106130000_salary_income_lines.sql`
  (owner applies it himself, after approval and a local replay per `§6.2`).
  Additive only; `salary_records` is untouched.
- Table `public.salary_income_lines`, following `salary_records` conventions
  (`id` TEXT primary key, `month` TEXT `YYYY-MM`, `user_id` UUID referencing
  `auth.users(id)` ON DELETE CASCADE):
  - `id TEXT PRIMARY KEY`
  - `user_id UUID NOT NULL`
  - `month TEXT NOT NULL`
  - `type TEXT NOT NULL CHECK (type IN ('salary','bonus','one_time'))` (plaintext)
  - `label TEXT NOT NULL` (encrypted)
  - `amount TEXT NOT NULL` (encrypted)
  - `position INTEGER NOT NULL DEFAULT 0` (stable display order)
  - `created_at`, `updated_at` timestamptz as in `salary_records`
  - index on `(user_id, month)`
- RLS enabled in the same migration with the same policy shape as
  `salary_records`: `FOR ALL USING (auth.uid() = user_id)`, plus
  `WITH CHECK (auth.uid() = user_id)` so inserts cannot target another user.
- Function `public.replace_salary_month(p_month text, p_lines jsonb, p_salary text, p_bonus text)`,
  `SECURITY INVOKER` so RLS applies. In one transaction it deletes the caller's
  lines for the month, inserts the new lines, and upserts the legacy
  `salary_records` row. This keeps a save atomic, which two separate client
  calls cannot do. It never reads or compares encrypted values.
- Legacy columns `salary_records.salary` and `salary_records.bonus` are kept.
  Each save dual-writes them (encrypted sum of `salary` lines, encrypted sum of
  `bonus` lines; `one_time` is not written there). This keeps a revert of the
  code usable and keeps `salary_records` NOT NULL constraints satisfied for a
  month that has only one-time lines (both values are `0`).

### Backfill (Proposal: synthesize on read)

The DEK exists only in the HttpOnly cookie, so SQL cannot convert legacy rows.
Two in-app options:

- Synthesize on read (chosen). When a month has a legacy row but no lines, the
  read action returns one `salary` line labelled "Salary" and, when bonus > 0,
  one `bonus` line labelled "Bonus". Real lines are written the first time the
  owner saves that month. Why: it needs no write on read, no one-shot job that
  can half-finish after a PIN unlock, and no ordering problem; reads stay
  idempotent and the legacy row stays the source of truth until the owner edits
  the month.
- One-shot backfill action after PIN unlock (rejected). It is a bulk write
  triggered from a read path, it needs failure and retry state, and it gains
  nothing the synthesized view does not already give.

Rules: if any lines exist for a month, lines win and the legacy row is ignored
for that month. If none exist, the legacy row is synthesized. No legacy row is
deleted, so there is no destructive step (`§6.3`).

### Types, schemas, aggregate helper

- `src/features/salary/types.ts`: add `IncomeLineType`, `IncomeLine
{ id: string; type; label: string; amount: number }`, and
  `SalaryMonth { id: YYYY-MM; lines: IncomeLine[] }`. Keep the exported
  `SalaryData` name as the per-month shape consumers already import, extended
  with `lines` and the derived totals below, so consumer changes are small.
- `src/features/salary/schemas.ts`: `incomeLineSchema` (type enum, `label` trimmed
  1 to 60 characters, `amount` finite and greater than 0 with an upper bound
  consistent with `export-validation.ts`), and `salaryMonthSchema`
  (`id: YYYY_MM`, `lines` 1 to 20 entries). Refinement: at most one `salary`
  line per normalized label (trim, case-insensitive) within a month. Keep
  `salaryDataSchema` only if the legacy shape is still needed for export
  validation of old files.
- `src/features/salary/lib/income-aggregates.ts` (new, pure): one helper,
  `summarizeMonth(lines)` returning `{ recurring, bonus, oneTime, total }`, plus
  `recurringByEmployer(lines)` (normalized label to amount, `salary` lines only)
  and `trailingTwelveMonths(months, upToId)` returning the bonus and one-time
  totals over the last 12 calendar months. All consumers use this helper; no
  consumer re-implements the sums.

### Actions (`src/features/salary/actions/salary-actions.ts`)

All encryption-touching paths below call `encryptPayload`/`decryptNumber` and
decrypt labels with the existing string decrypt helper in `crypto-fields`.

- `getSalaryRecords()`: reads lines and legacy rows with `readAllRows`, groups by
  month, applies the synthesize-on-read rule, returns months with lines and
  aggregates. Order and filtering happen in memory after decrypt (`§5.4`).
- `getSalaryRecord(id)`: same for one month.
- `upsertSalaryRecord(month)`: validates with Zod at the boundary, calls
  `requireActionContext()`, encrypts every label and amount, computes the
  legacy sums, and calls `replace_salary_month`. Saving a month with zero lines
  is rejected; use delete.
- `deleteSalaryRecord(id)`: deletes the month's lines and the legacy row in one
  call (delete-all-lines is the same as delete month).
- Errors are opaque: `throwIfSupabaseError` as today, no table, column or
  constraint text reaches the client, detail is logged server-side only.

### Consumers (every one listed; paths confirmed by grep)

Data layer and shared:

- `src/features/salary/hooks/use-salary.ts`, `hooks/index.ts`, `index.ts`
  (barrel): `useSalaryRecords` returns the new shape; export the new types and
  the helper through the barrel.
- `src/features/overview/actions/overview-actions.ts` and
  `src/features/overview/components/overview-prefetch.tsx`: pass through the
  new shape (no logic change expected).
- `src/lib/overview-read-context.tsx`: type-only check.

Salary page and UI (slice 2):

- `src/app/dashboard/salary/page.tsx`, `loading.tsx`, `salary-skeleton.tsx`
- `src/features/salary/components/salary-form.tsx`: dynamic list of lines (add,
  remove, type select, label, amount). New month prefills from the latest
  month's `salary` lines (labels and amounts), so a raise is editing one
  amount. Replaces the single prefill at ~line 54.
- `salary-table.tsx`: one row per month with recurring, bonus, one-time and
  total columns, expandable to show lines; salary changes are visible as a
  change marker on a month where a salary line's amount or employer differs from
  the previous month.
- `salary-chart.tsx` and `salary-chart-content.tsx`: stacked series for recurring,
  bonus and one-time.
- `salary-summary.tsx` and `salary-summary-cards.tsx`: recurring headline, with
  bonus and one-time shown separately.
- `use-salary-ytd-stats.ts`: YTD recurring, bonus and one-time separately;
  `estAnnualSalary` is based on recurring only. Months with only one-time lines
  do not count as a recorded salary month.
- `tax-reliefs-dialog.tsx`: feeds from the same aggregates (check only).

Planner, overview, review, search, export (slice 3):

- `src/features/assets/components/salary-planner.tsx` (~line 126): gross is the
  latest month's `recurring`, not `at(-1).salary`. A secondary line shows
  trailing-12-month bonus and one-time income as separate, un-planned income.
  `src/features/assets/lib/salary-plan.ts` keeps taking a single `salary`
  number; `planner-inputs.tsx`, `planner-results-content.tsx`,
  `market-deployment-card.tsx`, `first-record-prompt.tsx` are reviewed
  for copy that says "salary" and changed only if it is now wrong.
- `src/features/overview/lib/glance.ts` (`salaryGlance`) and
  `src/features/overview/components/latest-records.tsx` (~line 216): use
  `recurring`, including "vs a year ago" and the last-raise detection.
  `src/app/dashboard/(overview)/dashboard-overview.tsx` passes the new shape.
- `src/features/review/lib/monthly-review.ts` and
  `src/features/review/components/monthly-review.tsx`: income for the month is
  `total` (all lines), since the review compares real cash in; the "salary
  record available" check becomes "income record available".
  `monthly-review-sources.tsx` and `budget-reserve-worksheet.tsx` are reviewed
  for salary reads.
- `src/features/search/components/record-search-task.tsx` and
  `src/features/search/lib/record-search.ts`: match on month and on decrypted
  line labels and types in memory; result label shows the line count.
  `search/constants.ts` and `search/types.ts` updated for the new shape.
- `src/features/profile/lib/export-data.ts`, `export-validation.ts`
  (`salary` strict object at ~line 90), `export-review-constants.ts`,
  `hooks/use-export-data.ts`, `components/export-data-card.tsx`: the export
  includes lines. Validation accepts both the legacy
  `{ id, salary, bonus }` rows and the new `lines` shape, so older export files
  still load.
- `src/features/salary/lib/cpf-estimate.ts` and `lib/tax-cpf.ts`: see CPF and
  tax below. `lib/tax-reliefs.ts` and `constants.ts`: no change expected.
- Copy-only references (checked, changed only if wrong):
  `src/components/layout/dashboard-navbar.tsx`, `src/lib/constants/routes.ts`,
  `src/features/marketing/*`, `src/features/overview/constants.ts`,
  `src/features/expenses/constants.ts`, `src/features/household/components/split-picker.tsx`,
  `src/features/assets/actions/scenario-actions.ts`, `scenario-plan.ts`,
  `scenario-dialog.tsx`, `planning-scenarios.tsx`, `investment-math.ts`.

### CPF and tax (Decision 3)

- `cpf-estimate.ts`: for each month, OW per employer is
  `min(line.amount, OW ceiling)` for each `salary` line, grouped by normalized
  label, summed across employers. Annual OW is the sum over the year. `bonus`
  lines are AW; CPF on AW is capped by the existing annual AW ceiling logic fed
  with the year's total OW, summed across bonus lines. `one_time` lines add no
  CPF. Existing ceiling constants are reused, not re-typed.
- `tax-cpf.ts`: gross annual income is the sum of all lines (recurring + bonus +
  one-time). CPF relief comes from the above. The annual projection keeps its
  "equal payments in twelve months" assumption for recurring and bonus; one-time
  income is added as recorded, not projected.
- Employer identity is the salary line's label, normalized by trim and
  case-insensitive compare. Same label twice in a month is a validation error,
  not a merge.

### Edge cases

- Month with only `one_time` lines: valid. Recurring is 0; it does not become
  the "latest month" for the planner or the glance card (both use the latest
  month that has at least one `salary` line).
- Two employers in one month (job switch mid-month): two `salary` lines with
  different labels, each capped separately for CPF. The table marks the
  change; recurring for the month is their sum.
- Delete all lines for a month: the form disables Save and offers Delete month;
  the action rejects an empty month on upsert.
- Employer rename: treated as a new employer for CPF grouping; noted in the
  form hint.
- Validation: positive amounts, 1 to 60 character trimmed labels, 1 to 20 lines
  per month, duplicate salary labels rejected, all at the action boundary with
  `parseOrThrow` and opaque client messages.

## Out of scope

- Partner or household income (stays in the partner's own account).
- Net pay, payslip import, per-line CPF overrides, multi-currency.
- A new ordinary-wage or tax-bracket model; only the per-employer and
  per-line-type changes in Decision 3.
- Changing the planner's 20% flat CPF assumption in `salary-plan.ts`.
- Deleting the legacy `salary`/`bonus` columns or any backfill in SQL.
- A PIN-change re-key path for the new table (the old `rekey_user_data` RPC was
  dropped in `20260528010000_drop_rekey_rpc.sql`); any future re-key must
  include `salary_income_lines`.

## Implementation slices

1. Migration, schemas, types, actions with synthesize-on-read, the aggregate
   helper, and tests. Gate: helper and action tests pass; consumers still
   compile through the extended `SalaryData`.
2. Salary page UI: form, table, chart, summary, YTD hook.
3. Consumers: planner, overview glance, monthly review, search, export and
   import validation, CPF and tax libs.

The owner applies the migration after slice 1 lands and before slice 2 ships.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green
- [ ] Migration adds `salary_income_lines` with RLS and `WITH CHECK`, is
      additive, and replays cleanly on a fresh DB copy
- [ ] Unit tests: `summarizeMonth`, `recurringByEmployer`,
      `trailingTwelveMonths`, synthesize-on-read rule, schema rules (duplicate
      salary label, zero or negative amount, label length, line cap), per-employer
      OW cap, AW cap, one-time without CPF, tax gross including all lines
- [ ] Tests for the edge cases: one-time-only month, two employers in one month,
      empty month rejected, legacy-only month, lines-win-over-legacy
- [ ] Export round-trip test: new shape exports and re-imports; a legacy
      export file still validates
- [ ] No `any`, no `console.log`, no `@ts-ignore`; errors returned to the client
      contain no Supabase or Postgres text
- [ ] Manual: a legacy month opens as Salary (and Bonus if any), saving it
      writes real lines; adding a second job and a bonus updates the table,
      chart and YTD; raising one salary amount shows a change marker
- [ ] Manual: planner gross equals the latest month's salary lines only and
      shows trailing-12-month bonus and one-time separately; At a glance Salary
      and "vs a year ago" ignore bonus and one-time
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: all salary consumers (about 25 files), the CPF and tax
  estimates, planner gross, and export or import. Encrypted data is only added,
  never rewritten in place except by the owner's own saves.
- **Reversibility**: code is a git revert. The migration is additive and the
  legacy row is dual-written, so a reverted app still reads current recurring
  and bonus totals; lines remain in the new table unused. One-time lines would
  not appear in a reverted app.
- **Backout plan**: revert the commits; leave the table in place (dropping it
  needs a backup spec under `§6.3`); legacy rows already hold the latest
  salary and bonus sums.
- Risk: dual-write drift if a save fails midway; mitigated by the single
  transactional function. Risk: employer label typos split CPF grouping;
  mitigated by the normalized compare and a form hint.

## Open questions

- [x] Q: Is synthesize-on-read acceptable instead of a one-shot backfill? — Owner: Clarence — A: Yes, synthesize-on-read accepted (Clarence, 2026-11-06).
- [x] Q: Dual-write the legacy `salary`/`bonus` columns for rollback safety, or stop writing them once lines exist? — Owner: Clarence — A: Keep dual-writing legacy salary/bonus (Clarence, 2026-11-06).
- [x] Q: Maximum 20 lines per month and 60-character labels: right limits? — Owner: Clarence — A: 20 lines and 60 characters accepted (Clarence, 2026-11-06).
- [x] Q: Should the monthly review count `total` (all lines) as income, as proposed, or recurring only? — Owner: Clarence — A: Count total, all lines (Clarence, 2026-11-06).
