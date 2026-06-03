---
id: 007
slug: decompose-oversized-components
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner: "do all" — decompose the 6 oversized components
shipped: 2026-06-03
impl_pr: direct-to-main (solo project; 6 commits, one per file)
supersedes:
constitution_satisfies:
  - '§3.4' # file naming for new sub-component files
  - '§4.1' # presentational decomposition; feature seams preserved
constitution_overrides:
---

# Spec refactor/007: Decompose oversized feature components

## Problem

Six feature components exceed ~390 LOC: `expense-table` 614,
`investment-breakdown` 570, `salary-planner` 494, `expense-quick-add` 430,
`trade-form` 404, `tax-reliefs-dialog` 395. The audit (Phase 3) already
extracted their **pure logic** into tested libs, so the remaining bulk is large
JSX with several visually-distinct regions in one file — harder to read, hold in
context, and edit reliably. This is purely structural debt; behavior is correct.

## Constitution check

- Satisfies: `§3.4` (kebab-case files for the new sub-components), `§4.1`
  (presentational split; feature barrels/exports unchanged). Overrides: none.
- **No `HARD` rule touched.** No encryption/auth/schema/dependency change. No
  change to props consumed by pages or to server actions/hooks.

## Solution shape

For each file: extract the visually-distinct JSX regions into **focused,
presentational sub-components** (props in → JSX out) co-located as kebab-case
siblings in the same `features/<name>/components/` folder. **All state, hooks,
and handlers stay in the container**; sub-components receive values + callbacks
as props. The public component keeps its name, export, props, and behavior —
this is behavior-preserving structure only. Each file lands as its **own commit**
(independently revertable) with gates green.

- **`investment-breakdown.tsx`** → extract `MarketDeploymentCard` (the SG/US
  market card, mapped ×2), `MonthlyInvestmentTable` (ratio accordion table),
  `DeployableCashBreakdown` (deployable-cash accordion). Container keeps the
  hooks + `computeInvestmentBreakdown` + localStorage ratio/alloc state.
- **`expense-table.tsx`** → extract the filter/sort toolbar, the table header,
  the read row, and the inline-edit/new row into sub-components; container keeps
  the editing state machine + mutations. **Highest risk (inline edit + optimistic
  mutations)** — characterization render tests added before/with the split.
- **`salary-planner.tsx`** → already has `SalaryPlanner` (gate) + `SalaryPlannerInner`;
  extract the allocation inputs panel and the pie/breakdown panel from `Inner`.
- **`expense-quick-add.tsx`** → extract the entry-row form and the
  summary/preview region; container keeps form + mutation state.
- **`trade-form.tsx`** → extract the fee/preview section and grouped field
  blocks; container keeps RHF + submit.
- **`tax-reliefs-dialog.tsx`** → extract per-relief-section rows; container keeps
  RHF + mutation.

Exact sub-component boundaries are finalized per file at impl (each reads as a
self-contained presentational unit). Barrel exports unchanged unless a
sub-component is reused across files (none expected — they stay private to the
folder, imported directly by their container).

## Out of scope

- Any behavior, layout, or styling change (pixel-identical render).
- Pure-logic changes (already extracted by the audit).
- The page/loading/error work (fix/023–025).
- Adding features or new props to the public components.

## Acceptance

- [ ] `pnpm check` green after each file's commit
- [ ] `pnpm test:ci` green; at least one RTL render test per decomposed file
      (the extracted sub-components render their key content from props);
      `expense-table` gets characterization tests covering filter + a read row
- [ ] `pnpm build` green
- [ ] Each of the six source files is materially smaller and composes named
      sub-components; no public component changed name/props/export
- [ ] Each file decomposed in its own commit
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: presentation of the six components. `expense-table` is the
  riskiest (interactive inline edit) — mitigated by characterization tests and
  keeping all state in the container. No data/auth/crypto path touched.
- **Reversibility**: per-file `git revert` (each file is its own commit).
- **Backout plan**: revert the specific component's commit; others stand alone.

## Open questions

- None. (Behavior-preserving structural split; one commit per file.)
