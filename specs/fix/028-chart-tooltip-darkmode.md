---
id: 028
slug: chart-tooltip-darkmode
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

# Spec 028: Dashboard chart tooltips — dark-mode theming

## Problem

Closing the whole-codebase dark-mode audit (owner request after specs 026/027).
Charts that use recharts' **default** `Tooltip` (no custom `content`) render the
library's hard-coded popup: white background, `#ccc` border, near-black label
text. On the dark theme this is a bright white box on a dark page, and if the
background alone were flipped the default `#000` label text would vanish — so
both the surface and the label colour must be themed together.

Four dashboard charts use the default tooltip:

- `src/features/salary/components/salary-chart.tsx`
- `src/features/assets/components/asset-bar-chart.tsx`
- `src/features/assets/components/category-breakdown.tsx`
- `src/features/assets/components/planner-results.tsx`

`expense-chart.tsx` already ships a custom theme-aware tooltip (`content={...}`,
`bg-background`) — out of scope. shadcn UI tooltips
(`market-deployment-card`, `relief-row`, `investment-breakdown`,
`tax-reliefs-dialog`) already use semantic tokens — out of scope.

## Audit closure (the rest of the codebase)

Read-only sweep for hard-coded colours / non-semantic Tailwind in dashboard
surfaces. Findings:

- Dashboard navbar branch, tables, cards, sheets, dialogs → semantic tokens
  (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-accent`).
  No defect.
- `text-white` / `bg-zinc-*` / `bg-black` occurrences are confined to
  `features/marketing/*`, `(public)/page.tsx`, the public navbar branch, and
  `auth/vault-unlock-flow.tsx` — all **intentionally dark in both themes**
  (owner-confirmed in spec 027). Not defects.
- Pie charts (`planner-results`, `salary-planner`) colour slices from per-datum
  `fill` (recharts reads it directly; no `<Cell>` needed) — already correct.
- Chart axis text + CPF bar `<Cell>` coloring → fixed in spec 027.

Default tooltips are the only remaining real dark-mode legibility defect. After
this spec the dashboard dark-mode audit is closed.

## Constitution check

- Satisfies: `§4.1` (gates stay green), `§3.1` (pinned stack — recharts 3.8.1 +
  Tailwind CSS vars only; no new deps).
- Overrides: none. No `HARD` rule touched. All affected components already
  `'use client'`.

## Solution shape

- **`src/lib/recharts.ts`:** add a shared themed-tooltip prop bag next to
  `CHART_AXIS_TICK_PROPS`, driven by Tailwind CSS theme vars so it tracks
  light/dark automatically:

  ```ts
  export const CHART_TOOLTIP_PROPS = {
    contentStyle: {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: '0.5rem',
      color: 'var(--foreground)',
    },
    labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  } as const;
  ```

  `itemStyle` is intentionally left untouched so each series keeps its own
  colour (visible on either surface).

- **Each of the four charts:** spread `{...CHART_TOOLTIP_PROPS}` onto the default
  `<Tooltip>`. Remove the now-redundant inline `labelStyle={{ fontWeight: ... }}`
  in `salary-chart` and `asset-bar-chart` (folded into the shared const).
  `asset-bar-chart`'s `position` / `offset` props are unrelated and stay.

- **Test:** extend `test/lib/recharts.test.ts` to assert `CHART_TOOLTIP_PROPS`
  is theme-driven — `contentStyle.backgroundColor === 'var(--background)'` and
  `labelStyle.color === 'var(--foreground)'` — guarding against a regression back
  to hard-coded colours.

## Out of scope

- `expense-chart.tsx` custom tooltip (already themed).
- shadcn UI tooltips (already semantic).
- Marketing / public / vault surfaces (intentionally dark).
- Tooltip layout / content / formatter logic — colour theming only.

## Acceptance

- [x] `pnpm check` green
- [x] `pnpm test:ci` green; new assertion covers `CHART_TOOLTIP_PROPS`
- [x] `pnpm build` green
- [ ] Manual (dark): salary / asset / category-breakdown / planner tooltips show
      a dark themed surface with legible label + series text.
- [ ] Manual (light): no regression — same tooltips still legible.
- [x] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius:** presentational only — one shared const + four chart
  components. No data, auth, or encryption path.
- **Reversibility:** single `git revert`. No migration, no state.
- **Backout plan:** revert the impl commit.

## Open questions

- None.
