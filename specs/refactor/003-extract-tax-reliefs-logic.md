---
id: 003
slug: extract-tax-reliefs-logic
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved roadmap Phase 3 (SRP)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # SRP — relief state/derivation logic out of the dialog
  - '§4.2' # ships unit tests for the extracted logic
constitution_overrides:
---

# Spec refactor/003: Extract tax-relief state logic into a tested lib

## Problem

`tax-reliefs-dialog.tsx` (454 lines, audit Phase 3) held three pure functions inline —
`buildInitialState` (recover count/variant from a saved amount), `buildReliefItems` (labelled
line-items), `computeTotal` — fused with the dialog JSX. The count/variant recovery is non-trivial
(reverse-derives a count from `amount / defaultAmount`) and was untested.

## Constitution check

- Satisfies `§3.1` (SRP) and `§4.2` (tests). Overrides: none. No migration, no new dependency, no
  encryption path. Behavior-preserving extraction.

## Solution shape

- New `src/features/salary/lib/tax-reliefs.ts`: `ReliefState`/`ReliefStateMap` types +
  `buildInitialState`, `buildReliefItems`, `computeTotal` (pure over `RELIEF_CATALOG` + args).
- `tax-reliefs-dialog.tsx` imports them; the inline copies are removed. JSX unchanged.

## Out of scope

- Decomposing the dialog JSX (no render test harness).
- The other oversized components (own specs).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [x] New `test/features/salary/tax-reliefs.test.ts`: defaults-when-unsaved, restore saved amount,
      count recovery, variant recovery, `computeTotal` enabled-only, `buildReliefItems` enabled-only.
      229 total.
- [x] No new dependency, no `any`, no `console.log`.

## Risk & reversibility

- **Blast radius**: the tax-reliefs dialog only; literal extraction, JSX untouched.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
