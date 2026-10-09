---
id: '088'
area: audit
status: approved
created: 2026-10-10
author: Codex
constitution_satisfies: ['§2.1', '§2.3', '§3.1', '§4.1', '§4.2', '§7.4', '§8.2']
---

# Monthly CPF planning estimate accuracy

## Authorization and evidence

Clarence's 2026-10-10 continuation and parallel-worktree request authorizes ordinary remediation under §7.4 and roadmap081 batch D. This records reversible corrections to the existing explicitly assumed full-rate, age55-and-below employee planning model; it does not approve eligibility fields or a payroll product.

Existing calculations apply20% at all wages, omit employee whole-dollar rounding, cap aggregated annual wages instead of each month, use the September2023 ceiling before September and silently substitute2026 rules for unsupported years. Recorded YTD is labelled True Annual although AW contributions can require annual reconciliation.

## Scope and contract

Salary constants, lib/tax-cpf.ts, a pure lib/cpf-estimate.ts, hooks/use-salary-ytd-stats.ts, components/salary-summary.tsx and salary-summary-cards.tsx, corresponding tests and this record. README integration is owned by root. No profile persistence, migrations, dependencies, crypto or protected changes.

Use confirmed2023–2026 full-rate employee rules: no employee deduction through500; phased deduction for combined monthly OW+AW above500 through750;20% on subject wages above750. Floor the combined employee deduction, not independently OW and AW. Cap OW by actual calendar month; AW annual ceiling uses annual subject OW. Calculate recorded months separately, allocating subject AW chronologically. Incomplete-year AW ceiling is provisional because future OW changes it. Annual projection models12 months of average recorded salary/bonus and states that assumption. Unsupported years and arithmetic-invalid inputs produce an unavailable estimate, never a current-rule guess. Preserve historical IRAS tax-table behavior independently of unsupported CPF rules.

Citizenship, PR contribution arrangements, exact birthday month, multiple employers and annual payroll reconciliation are not established by existing data. Tax residency is not CPF eligibility. Keep essential assumptions visible; do not add mandatory onboarding inputs or infer eligibility.

## Acceptance and rollback

Fixtures: wages0/50/500/501/750/751, fractional rounding, OW ceilings,2023August/September,2025/2026, uneven salary and one high-pay month, combined OW+AW wagebands and one rounding step, AW annual ceiling, duplicate/invalid records, unsupported years, overflow, recorded versus projected labels and profile-read failures. Meaningful regressions must fail against shipped behavior. Full standard gates use isolated synthetic fixture, every aggregate coverage metric above80% and security floors unchanged; independent second review. Revert batch commit for rollback; no stored-data change.

## Research and skills

[CPF2026 tables](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf), [2023September transition](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/cpfcontributionandallocationratesfrom_1sep2023.pdf), [CPF employer calculation](https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay), [AW ceiling](https://www.cpf.gov.sg/service/article/what-is-the-additional-wage-aw-ceiling), [eligibility](https://www.cpf.gov.sg/employer/employer-obligations/who-should-receive-cpf-contributions).

Impeccable harden/craft-floor applied narrowly in Operate mode to existing components. Context script skipped under owner privacy constraint because earlier inspection found unrelated credential/cache discovery. No skill/harness changes. TemplateCentral/frontend-design unavailable; no installation assumed.

## AW wage-band boundary research

[CPF Board AW worked examples](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/ExamplesonAdditionalWageCeilingComputation.pdf), example16/page20, explicitly determines the wage band from total paid wages BEFORE capping AW. Preserve paid bonus separately from eligible AW in monthly arithmetic. Its500 monthlyOW/162000 annualAW example yields1200 employeeOW plus19200 employeeAW, total20400; after AW exhaustion monthly employeeOW remains100 when paidAW exceeds250. Use this published synthetic fixture as an independent contract, not a guessed rule.

## Independent review corrections and residuals

The second reviewer identified the capped-AW phased-wage boundary, misleading shared Gross Annual label for recorded YTD, and projection readiness despite invalid monthly histories. Withhold phased-band results when eligible AW is less than paid AW pending a direct contract. [CPF Board AW calculator](https://www.cpf.gov.sg/member/tools-and-services/calculators/additional-wage-ceiling-calculator/) supports only years where every month's total wages exceed750, directing other cases to CPF Board; it does not resolve this disputed boundary. Preserve the published high-band example16. Gate both projections and recorded estimates on validated monthly history; gross income remains independently visible. Recorded and projected income headings are distinct.

The dashboard allocation planner in assets/lib/salary-plan.ts retains its separate flat20% planning assumption. This batch fixes Salary-page estimates only. Full eligibility, age transitions and PR arrangements still need separately approved fields/model. No verified filing or payroll claim is made.

## Verification — 2026-10-10

The isolated synthetic fixture passed final `pnpm check` (format, lint and typecheck), `pnpm test:ci` and `pnpm build`. All 116 test files and 910 tests passed. Aggregate coverage: statements 92.72% (3517/3793), branches 87.95% (2103/2391), functions 90.23% (1136/1259), lines 92.99% (3239/3483). Existing coverage floors were unchanged. Evidence: `088-final-gates.log` in the external visualization directory.

Three focused regressions failed against shipped `tax-cpf.ts` and `constants.ts`: monthly wages 500 produced 100 instead of 0; wages 5000.99 produced 1000.198 instead of the rounded 1000; August 2023 wages 7000 produced 1260 instead of 1200. The fixture's corrected files were restored byte for byte with SHA-256 checks before final gates. Evidence: `088-red-baseline.log`. Targeted corrected tests and typecheck passed before the final full run.

An independent source reviewer completed a second pass after the accepted corrections and found no remaining actionable issue within this scope. The parent completed synthetic desktop and 390px mobile component checks: one recorded 20000 month shows CPF 1600 versus projected 19200; wages 500 show zero CPF; profile loading, errors and incomplete inputs preserve gross income while withholding tax. Mobile scroll width matched viewport width. Evidence: `088-desktop-proof.jpg` and `088-mobile-proof.jpg` in the external visualization directory. The standalone preview used Next Link and tax-relief action adapters, so it does not prove live navigation or persistence. No confidential accounts or production records were accessed.
