---
id: '073'
status: owner-authorized-remediation
created: 2026-10-09
author: Codex
---

# Employment tax accuracy remediation

## Authorization and evidence

Clarence requested the whole-project accuracy audit and authorized continued
improvements on 2026-10-09. This is a reversible bug-fix batch under constitution
§7.4 and roadmap072, not agent approval of a new feature or migration.

The estimator uses 22% for non-resident employment income, subtracts CPF personal
relief for non-residents, omits the resident top brackets introduced in YA2024,
and does not apply the overall personal relief cap including CPF.

Authoritative contracts:

- [IRAS rates](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates): employment income uses the higher of15% or resident progressive rates. YA2024 adds23% above500000 and24% above1000000. Calendar income year2023 corresponds to YA2024.
- [IRAS reliefs](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs): personal reliefs are for residents and capped at80000 including CPF; the worked example explicitly includes CPF.

## Affected paths and implementation contract

`src/features/salary/constants.ts`, `lib/tax-cpf.ts`,
`components/{salary-summary,tax-reliefs-dialog}.tsx`, their existing tests,
README and roadmap progress. No persistence, encryption, authentication, schema,
dependency or protected-path changes (§2/§3/§5/§8 remain intact).

Use15% employment rate and compare progressive tax on gross employment income
without personal reliefs for non-residents. Preserve the independently modelled
CPF deduction for take-home calculations; residency does not establish CPF
eligibility. Chargeable income must reflect the same tax base.

Select the correct progressive table by calendar income year; standalone
`calculateTax` without a year uses the current table. Preserve historical
pre2023 calculations. Apply the80000 overall cap to CPF plus personal reliefs
when deriving resident chargeable income. Retain requested relief breakdown
amounts and explain the cap, rather than falsely rewriting stored claims.

Correct both stale22% labels. Keep a concise visible estimate assumption: fixed
20% CPF model, no age/PR-stage eligibility calculation, tax before rebates and
special exemptions. Details do not become a new mandatory onboarding form.
Remove nearby comments that merely narrate headings already visible in JSX.

## Acceptance and rollback

Prove regressions red on original source:100000 non-resident employment→15000;
high-income progressive comparison excludes CPF/personal reliefs; published
500000/1000000 bracket totals and historical year boundary; resident relief cap
includes CPF with below/at/above cap tests. Existing small-income results remain.
UI tests must assert the corrected rate and estimate assumptions.

Run formatting/lint/typecheck, full coverage above80% every aggregate metric,
optimized synthetic build, and second source/consumer review. No live account
or secret access. Revert the code batch to roll back; no data rollback required.

## Residual scope

CPF remains a fixed20% estimate: citizenship/PR stage, age contribution tiers,
monthly rounding, uneven pay and the2023 intra-year ceiling change need a
separately researched model. Personal relief eligibility/catalog lifecycle,
tax rebates, short employment exemptions and deductions are not solved by this
batch and must not be presented as a verified filing calculation.

## Results

Implemented with four regressions proven red against original source. The
isolated full suite passes108files/824tests:92.84%lines,92.60%statements,
90.03%functions,87.03%branches. Formatting, route logging, lint, typecheck and
optimized synthetic build pass. Additional UI assertions for the visible CPF
assumption and relief cap pass in the focused suite.

Second review verified all formula consumers, year forwarding, the original
small-income contract, no residency-to-CPF eligibility inference, requested
relief breakdown versus allowed combined cap, and both non-resident labels.
README and inline comments were reviewed for durable rationale; redundant
heading narration was removed. This fixes tax calculation bugs, not the
remaining payroll/eligibility model. No latency improvement is claimed.

PR and CI integration remain required before marking this batch shipped.

Historical boundary follow-up in the same batch: IRAS states the overall cap
took effect in YA2018 (calendar income year2017). Preserve earlier income-year
relief behavior and add a2016/2017 boundary regression before integration.

Consumer-copy correction: `profile/components/profile-form.tsx` claims birth
year determines CPF contribution rates, although the model is fixed20%.
Correct its description to tax estimates and earned-income relief only. No
profile fields, storage or validation change; verify formatting and existing
profile interaction tests with the full gates.
