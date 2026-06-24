---
id: 051
slug: a11y-pagination-and-settle-darkmode
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-25)
created: 2026-06-25
approved: 2026-06-25 # Clarence approved the audit roadmap (Everything 1-6); PR ceremony waived (personal project, direct-to-main)
shipped: 2026-06-25
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4' # UI/style polish consistent with the spec-036 a11y + spec-026/027/028 dark-mode work
constitution_overrides:
---

# Spec 051: Two low-severity UI nits (pagination label + settle-button dark mode)

## Problem

Audit (2026-06-25) surfaced two cosmetic gaps, both LOW:

1. `src/features/expenses/components/pagination-controls.tsx:64` — the "go to page" number input has
   an `aria-label` (a11y covered) but no programmatic label node; the surrounding "Page"/"of N" text
   is visual-only, slightly cramped on mobile.
2. `src/features/expenses/components/owed-summary.tsx:172` — the settle button hardcodes
   `bg-emerald-600 hover:bg-emerald-700` with no `dark:` variant; contrast in dark mode is unverified.

## Constitution check

- Satisfies `§4` — consistent with the existing spec-036 a11y pass and the spec-026/027/028 dark-mode
  token work; pure className/markup polish.
- Overrides: none. No HARD rule. No dependency, schema, or encryption touched.

## Solution shape

- **Pagination label.** Wrap/associate the page input with an `sr-only` label (or `aria-labelledby`
  binding the adjacent "Page" text) so screen readers get a stable name independent of layout. No
  visual change beyond the existing text.
- **Settle button dark mode.** Verified (2026-06-25): `emerald-600` with a white `Check` icon has
  sufficient contrast on both the light and dark card surface (it is the established "settled" accent,
  consistent with the emerald totals text). No change made — no churn for its own sake.

No change to behavior, actions, hooks, encryption, schemas, or data.

## Out of scope

- Any broader pagination redesign or table restyle.
- The math extractions (049) and the render-test/debt cleanup (050).

## Acceptance

- [ ] `pnpm format:check` + `pnpm lint` + `pnpm typecheck` green
- [ ] `pnpm test:ci` green (no behavior change; existing tests stay green)
- [ ] `pnpm build` green
- [ ] Manual: pagination input announces a stable name in a screen reader / has an associated label
- [ ] Manual: settle button is legible in dark mode (changed only if it was not)
- [ ] No `any`, no `console.log`, no new dependency
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: two className/markup edits in the expenses feature. No logic.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the impl commit.

## Open questions

- [ ] Q: none material.
