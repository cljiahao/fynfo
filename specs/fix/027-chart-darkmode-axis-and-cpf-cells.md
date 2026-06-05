---
id: 027
slug: chart-darkmode-axis-and-cpf-cells
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-05
approved: 2026-06-05 # YYYY-MM-DD, set on approval
shipped: 2026-06-05 # YYYY-MM-DD, set on impl merge
impl_pr: direct-to-main (solo project) # link to impl PR, set on shipped
supersedes: # spec id, if applicable
constitution_satisfies:
  - '§4.1'
  - '§3.1'
constitution_overrides:
  - section: none
---

# Spec 027: Dashboard chart dark-mode legibility — axis text + CPF bar cells

## Problem

The dashboard supports a real light/dark theme toggle (next-themes,
`attribute="class"`, default light; `ThemeToggle` in the user menu). Two classes
of dark-mode defects remain in the recharts dashboard charts:

1. **CPF bars render with recharts' default fill, not their per-account colors.**
   In `category-breakdown.tsx` the CPF BarChart colors each bar via `<Cell>`
   children imported from the dynamic `@/lib/recharts` barrel. recharts matches
   Cell children by `displayName` (`findAllByType(children, Cell)`); the
   `next/dynamic` wrapper has displayName `LoadableComponent`, not `Cell`, so the
   cells are dropped and the intended OA/SA/MA/SRS colors never apply. The bars
   fall back to recharts' own default fill — not theme-aware, illegible against
   the dark card background. Spec 026 fixed the axis/label _text_ in this card but
   not the _bars_.

2. **Axis tick text uses recharts' default fill (`#666`) on the other charts.**
   `asset-bar-chart.tsx`, `salary-chart.tsx`, and `expense-chart.tsx` render
   XAxis/YAxis tick labels with no theme-aware fill, so they are low-contrast /
   illegible in dark mode — the same defect 026 fixed for `category-breakdown`.

## Constitution check

- Satisfies: `§4.1` (gates stay green), `§3.1` (pinned stack — no new deps;
  recharts 3.8.1 + Tailwind only).
- Overrides: none. No `HARD` rule touched. All affected components are already
  `'use client'`; §2.5 unaffected.

## Solution shape

- **`src/lib/recharts.ts`:**
  - Replace the dynamic `Cell` export with a static re-export:
    `export { Cell } from 'recharts';`. Cell is a pure config marker (renders
    nothing standalone, no browser APIs) and only mounts inside the already
    `ssr:false` `Bar`, so a static import is SSR-safe and makes `findAllByType`
    recognize it. This fixes per-bar coloring for every current and future
    consumer centrally.
  - Add a shared axis-tick helper so chart text is theme-aware in one place:
    `export const CHART_AXIS_TICK_PROPS = { className: 'fill-foreground', tick: { fill: 'currentColor' } } as const;`
- **`src/features/assets/components/category-breakdown.tsx`:** no change needed
  for bar color (fixed via the barrel). Retrofit the 026 inline YAxis
  `className`/`tick` to spread `CHART_AXIS_TICK_PROPS` (single source of truth).
- **`asset-bar-chart.tsx`, `salary-chart.tsx`, `expense-chart.tsx`:** spread
  `{...CHART_AXIS_TICK_PROPS}` on every `XAxis`/`YAxis`. In `expense-chart.tsx`
  also change the `ReferenceLine` label `fill: '#64748b'` to `'currentColor'`.
- **Test:** add a deterministic unit test on the barrel asserting `Cell` from
  `@/lib/recharts` is recharts' real `Cell` (identity + `displayName === 'Cell'`)
  — this is the exact contract recharts' `findAllByType` relies on to apply
  `<Cell>` colors, so it guards the regression directly. A jsdom render test is
  deliberately avoided: dynamic (`ssr:false`) recharts + zero-size
  `ResponsiveContainer` in jsdom is flaky and would assert less precisely than
  the displayName match. Also assert `CHART_AXIS_TICK_PROPS` carries the
  `fill-foreground` class.

## Out of scope

- `auth/vault-unlock-flow.tsx` — full-screen lock modal, intentionally dark in
  both themes (owner-confirmed). Not touched.
- `features/marketing/*` and `(public)/page.tsx` — landing page is deliberately
  `.dark`; white-on-dark by design.
- Tooltips (already custom / legible), legends (series-colored), and the data /
  line / bar brand colors themselves.
- No restyle beyond axis text color + CPF bar recognition.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; new test asserts barrel `Cell` is recharts' real
      Cell (displayName `'Cell'`) and `CHART_AXIS_TICK_PROPS` is theme-aware
- [ ] `pnpm build` green
- [ ] Manual (dark): CPF bars show OA=blue / SA=green / MA=amber / SRS=purple,
      all visible; axis ticks legible on asset/salary/expense charts.
- [ ] Manual (light): no regression — same charts still legible.
- [ ] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius:** presentational only — four dashboard chart components plus a
  shared chart helper. No data, auth, or encryption path. The barrel Cell change
  affects only chart rendering.
- **Reversibility:** single `git revert`. No migration, no state.
- **Backout plan:** revert the impl commit.

## Open questions

- None. Per-account CPF coloring and dark-mode axis fix confirmed with owner.
