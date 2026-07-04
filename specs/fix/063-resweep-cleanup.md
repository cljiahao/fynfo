---
id: 063
slug: resweep-cleanup
area: fix
status: shipped
author: Claude (Opus 4.8)
created: 2026-07-05
approved: 2026-07-05
shipped: 2026-07-05
impl_pr: (direct to main)
supersedes:
constitution_satisfies:
  - '§1.1'
constitution_overrides:
---

# Spec 063: Post-redesign re-sweep cleanup

## Problem

A re-audit after specs 061/062 confirmed the token reshape is substantially
complete, but surfaced a tight set of genuine gaps — mostly components the
original audit never line-read, so the 061 sweep missed them:

- **Missed semantic colours** (bypass the token system, won't track the ramp):
  - `equity/trade-form.tsx:190,205` — Buy/Sell toggle uses raw
    `bg-emerald-600`/`bg-red-600` (exactly the gain/loss semantics tokenised
    elsewhere).
  - `household/goal-card.tsx:37,68,92` — raw `border-emerald-500/50` +
    `bg-emerald-500` (partner progress bar + legend dot); spec 054 was missed.
  - `equity/dividend-income-chart.tsx:53` — `<Bar fill="#10b981">` hardcoded.
  - `assets/salary-planner.tsx` — pie fill `#92400e` repeats the dark-unsafe
    brown already fixed in `CATEGORY_COLORS`.
- **A11y**: icon-only edit/delete buttons in the older tables lack `aria-label`
  (`salary-table`, `trade-table`, `snapshot-table`, `dividend-table`) — screen
  readers announce a bare "button". Newer components already label theirs.
- **Motion**: `prefers-reduced-motion` is not honoured globally (spinners,
  pulses, transitions ungated).
- **Contrast**: `--warning-strong` light value `oklch(0.5 0.13 65)` on
  `--warning-subtle` at 11px is right at the AA edge.

## Constitution check

- Satisfies: `§1.1` (usability, a11y, trust).
- Overrides: none.

## Solution shape

- **Colours → tokens**: trade-form Buy/Sell → `bg-gain`/`bg-loss` (+ hover);
  goal-card partner tone → `bg-chart-2` + `border-gain/50`;
  dividend-income-chart `fill` → `var(--chart-2)`; salary-planner `#92400e` →
  `#b45309` (match the pension fix).
- **A11y**: add `aria-label="Edit …"` / `aria-label="Delete …"` to the icon
  buttons in the four older tables.
- **Motion**: add a global `@media (prefers-reduced-motion: reduce)` guard in
  `globals.css` (near-zero animation/transition durations, `scroll-behavior:auto`).
- **Contrast**: darken `--warning-strong` light to `oklch(0.45 0.13 65)`.

## Out of scope (deferred, noted here so they're not lost)

- `auth/vault-unlock-flow.tsx` bespoke forced-dark palette — its own retheme
  spec (bigger; needs visual verification).
- **Radius standardisation** — sub-panel `rounded-lg`/`rounded-xl` drift; a
  visual judgement, defer to a browser-verified pass.
- Categorical chart palettes (`CATEGORY_COLORS`, `EXPENSE_TYPE_COLORS`,
  `CPF_COLORS`, salary-planner slices) — documented exception; need >6 distinct
  hues, legitimately raw.
- `portfolio-summary` → `StatCard` — kept custom by design (loading/error +
  breakdown rows), per spec 062.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Grep: no raw `bg-emerald-[0-9]`/`bg-red-[0-9]`/`text-emerald`/hardcoded
      chart hex remaining in the four touched files (marketing + categorical
      constants excepted)
- [ ] Manual: Buy/Sell buttons + goal progress render in both themes; the four
      tables' action buttons expose accessible names; OS "reduce motion" flattens
      app animation

## Risk & reversibility

- **Blast radius**: presentation + one CSS media query. No data/crypto/actions.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- none.
