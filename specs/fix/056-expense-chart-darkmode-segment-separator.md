---
id: 056
slug: expense-chart-darkmode-segment-separator
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-27
approved: 2026-06-27
shipped: 2026-06-27
impl_pr:
supersedes:
constitution_satisfies:
  - '§4' # UI/dark-mode polish, consistent with spec-026/027/028 chart dark-mode work
constitution_overrides:
---

# Spec 056: Expense bar chart — dark-mode stacked-segment separator

## Problem

In dark mode the stacked Monthly Expenses bar chart (`expense-chart.tsx`) _feels_
misaligned — the segment boundaries seem to shift, an optical "offset" the owner
reported (and correctly identified as illusion, not a real offset). Cause: the
stacked segments use high-chroma Tailwind-500 fills (`EXPENSE_TYPE_COLORS` —
`#6366f1`, `#ec4899`, `#f97316`, `#22c55e` …) with **no edge separation**, drawn
on a near-pure-black dark card (`--card: #101010`). Adjacent saturated segments
without a divider are the textbook stacked-bar boundary illusion, amplified by
high chroma on near-black. Light mode is unaffected (white card already separates
visually).

## Constitution check

- Satisfies `§4` — pure dark-mode UI polish, consistent with the spec-026/027/028
  chart dark-mode token work. No logic, data, encryption, or dependency change.
- Overrides: none. No HARD rule. `globals.css` + one component class — not a
  governance-protected path.

## Solution shape

Give each stacked segment a 1px **surface-colored** stroke so its edges read
crisply against neighbours — the established research fix for the boundary
illusion. Surface color = `var(--card)`, which resolves white in light / near-black
in dark automatically, so the separator tracks the theme with no JS or theme
detection (mirrors the repo's "drive charts from Tailwind vars" pattern in
`lib/recharts.ts`).

recharts sets a `<Bar>` `stroke` as an SVG presentation **attribute**, where
`var(--card)` would not resolve — so the stroke is applied via a scoped CSS rule
(CSS custom properties DO resolve in the `stroke` CSS property), which also
overrides recharts' default no-stroke.

- **`expense-chart.tsx`** — add a scoping class (e.g. `expenses-bar-chart`) to the
  existing chart wrapper `div` (`<div className="h-[350px] w-full">`). No other
  change to the component.
- **`globals.css`** — add, in `@layer base` (or a small chart layer):
  ```css
  .expenses-bar-chart .recharts-rectangle {
    stroke: var(--card);
    stroke-width: 1px;
  }
  ```
  Scoped to this chart only — other charts untouched. The surface-colored stroke
  on the outer/top edges sits against the same-colored card and is invisible
  there; it only shows between stacked segments, which is the intent.

No change to colors, data, the palette, tooltip, axes, or any other chart.

## Out of scope

- Re-palette / desaturation of `EXPENSE_TYPE_COLORS` (secondary lever; not needed
  if the separator resolves the illusion — revisit only if it still reads hot).
- Lifting dark `--card` off pure black globally (broader theme change).
- Any other chart (asset/salary/dividend) — only the reported expenses chart.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] Manual (dark mode): stacked segments show crisp 1px surface dividers; the
      perceived "offset"/vibration is gone; light mode visually unchanged.
- [ ] Only `expense-chart.tsx` (one className) + `globals.css` (one rule) touched.
- [ ] No `any`, no `console.log`, no dependency, no inline style added.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: one chart's appearance. Scoped CSS class — cannot affect other
  charts or components. No behavior change.
- **Reversibility**: single `git revert` (remove the class + the CSS rule).
- **Backout plan**: revert the commit.

## Open questions

- [ ] Q: Separator alone, or also a slight dark-mode desaturation of the palette?
      — Owner: Clarence — A (lean): **separator alone** first — it directly
      addresses the reported "offset" with the smallest change; desaturation is a
      bigger, palette-wide change to hold in reserve.
