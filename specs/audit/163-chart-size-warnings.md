---
id: 163
slug: chart-size-warnings
area: audit
status: draft
author: Claude
created: 2026-11-02
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§7.4'
constitution_overrides: []
---

# Audit163: Recharts width/height console warnings

## Authorization

Owner-authorized remediation under AGENTS.md section 1.5 and constitution section 7.4. Clarence asked on 2026-11-02 for the chart console warnings to be fixed. Approval of findings beyond this scope is not claimed.

## Problem

Every chart page logged "The width(-1) and height(-1) of chart should be greater than 0". Two causes, both confirmed in recharts 3.8.1 source (`node_modules/recharts/es6/component/ResponsiveContainer.js`, `responsiveContainerUtils.js`):

1. `ResponsiveContainer` defaults `initialDimension` to `-1 x -1` and calls `warn()` during the first render, before its effect measures the container. With `width="100%"` the calculated size is the container size, so the first render always warns, however correct the CSS.
2. `src/lib/recharts.ts` wrapped every primitive in its own `next/dynamic({ ssr: false })`. Each piece resolved separately, so the container mounted before its children and the chart re-rendered once per child.

Evidence: reasoning from recharts source plus a jsdom test (`test/components/chart-size-warning.test.tsx`) whose control case shows the stock container warns and whose fixed case does not. The live dashboard was not driven, since it needs real credentials.

## Affected paths

- `src/lib/recharts.ts`
- Chart components, each split into a lazy wrapper (original path) and a `*-content.tsx` holding the implementation: `marketing-trend-chart`, `asset-bar-chart`, `category-breakdown`, `planner-results`, `dividend-income-chart`, `expense-chart`, `salary-chart`.
- `test/components/chart-size-warning.test.tsx`

## Change

- Primitives are re-exported statically from `recharts`; `Cell` stays static as before, so per-bar colors and displayName matching are unchanged.
- `ResponsiveContainer` is exported as a thin wrapper defaulting `initialDimension` to `1 x 1` (callers may override).
- The lazy boundary moves up one level: each chart's original module is now a `next/dynamic({ ssr: false })` wrapper around its `*-content.tsx`. Importers and barrels are unchanged, and recharts still loads outside the initial JS, in one chunk per chart.
- `CHART_AXIS_TICK_PROPS` and `CHART_TOOLTIP_PROPS` are unchanged, so dark-mode tick and tooltip theming is preserved.

## Acceptance checks

- Regression test: stock container warns, `@/lib/recharts` container does not.
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- First-load JS per dashboard route not larger than on base (numbers in the delivery report).

## Rollback

Revert the implementing commit; no data, schema or dependency change is involved.

## Residual risk

Charts no longer render their surrounding card on the server; the whole card appears after the chart chunk loads. A container hidden at mount (zero size) can still warn legitimately.
