---
id: 050
slug: component-test-and-debt-cleanup
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-25)
created: 2026-06-25
approved: 2026-06-25 # Clarence approved the audit roadmap (Everything 1-6); PR ceremony waived (personal project, direct-to-main)
shipped: 2026-06-25
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # adds a render test; the dedup helper ships covered by the quick-add tests
  - '§4' # removes dead export surface; DRY the repeated self-expense payload
constitution_overrides:
---

# Spec 050: Component render test + low-risk debt cleanup

## Problem

Post-audit (2026-06-25) the repo is drift-free, but a few low-risk cleanups remain:

1. `src/features/assets/components/summary-cards.tsx` is 0% covered yet is the cleanest possible
   render target (pure props in, no hooks/fetch) — it exercises the MoM sign/percent/format branches.
2. `src/features/expenses/components/expense-quick-add.tsx` hand-builds the identical "self" expense
   payload three times (`handleSubmit`, single-row paste, multi-row paste) — duplication introduced/
   carried through spec 048.
3. ~14 `export`ed types/symbols are consumed only within their own file (`broker-fees.ts`,
   `investment-math.ts`, `salary-plan.ts`, `expense-table.ts`, `paste-parser.ts`, `export-data.ts`),
   plus a possibly-dead `totalsByTicker` in `equity/lib/dividend-metrics.ts` — needless public
   surface.

## Constitution check

- Satisfies:
  - `§4.2` — adds a jsdom render test for `summary-cards`; the new `buildSelfExpense` helper is
    covered by the existing spec-048 quick-add tests (which assert the emitted payload).
  - `§4` — DRY (single payload factory) and trimming dead export surface are direct style-rule
    cleanups.
- Overrides: none. No HARD rule touched. No new dependency. No encryption/schema/migration.

## Solution shape

- **`buildSelfExpense` factory.** Add to `src/features/expenses/lib/utils.ts` (home of `generateId`):
  `buildSelfExpense(p: { date: string; type: ExpenseType; item: string; info: string; amount:
number }): ExpenseData` returning `{ id: generateId(), ...p, splitType: 'self', splits: [] }`.
  Replace the three inline payloads in `expense-quick-add.tsx` with calls. Behavior identical (each
  call still mints a fresh `generateId()`). The existing spec-048 tests assert the payload shape, so
  they cover the helper; extend one assertion to confirm `splitType: 'self'`/`splits: []`.
- **`summary-cards` render test.** New `test/features/assets/summary-cards.test.tsx` (jsdom): render
  `SummaryCards` with a two-snapshot fixture and assert the Total/Excl-Pension figures and the
  Savings/Investment change cards show the correct signed delta + percent + arrow direction (covers
  the `change >= 0` and `previousId` branches). No mocks — `lib/calculations` runs for real.
- **Dead export trim.** Re-verification result (2026-06-25): the audit's "~14 in-file-only exports"
  was an over-flag. Those symbols live in unit-tested lib modules (`broker-fees`, `investment-math`,
  `salary-plan`, `expense-table`, `paste-parser`, `export-data`) and ARE imported by their `test/`
  suites — i.e. they are the tested public API, not dead surface. Dropping their `export` would break
  the test imports. So they are deliberately left as-is. The one genuinely-dead symbol is
  `totalsByTicker` in `equity/lib/dividend-metrics.ts` — referenced only by its own test, no app
  caller — which is removed (function + its test block). No blanket sweep; each claim verified by
  repo-wide search.

No change to actions, hooks, encryption, schemas, Supabase, or any component's rendered output.

## Out of scope

- The math extractions (mwr/owed) — spec 049.
- The a11y nits (pagination label, owed dark-mode button) — spec 051.
- Extracting the yield-on-cost sort comparator — left inline; covered indirectly. (If trivially
  testable during impl, a small unit test may be added, but no extraction.)
- Any `signed-format` shared util — deliberately not done (churn > value).

## Acceptance

- [ ] `pnpm format:check` + `pnpm lint` + `pnpm typecheck` green
- [ ] `pnpm test:coverage` green; new `summary-cards` test passes; quick-add tests still green
- [ ] `pnpm build` green
- [ ] `expense-quick-add.tsx` builds the self payload in exactly one place (`buildSelfExpense`)
- [x] Dead-export claim re-verified: only `totalsByTicker` genuinely dead (removed); the rest are
      test-consumed public API and left intact
- [ ] No `any`, no `console.log`, no new dependency
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: one expenses component (payload factory — pure refactor), one new test, and
  visibility-only edits (dropping `export`) that the typechecker validates. A wrongly-dropped
  `export` fails `pnpm typecheck` immediately.
- **Reversibility**: single `git revert`. No data/schema.
- **Backout plan**: revert the impl commit.

## Open questions

- [ ] Q: Remove `totalsByTicker` outright if test-only, or keep as a documented planned API? —
      Owner: Clarence — A: (lean remove if no live caller)
