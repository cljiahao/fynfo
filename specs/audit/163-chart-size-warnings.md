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
2. `src/lib/recharts.tsx` wrapped every primitive in its own `next/dynamic({ ssr: false })`. Each piece resolved separately, so the container mounted before its children and the chart re-rendered once per child.

Evidence: reasoning from recharts source plus a jsdom test (`test/components/chart-size-warning.test.tsx`) whose control case shows the stock container warns and whose fixed case does not. The live dashboard was not driven, since it needs real credentials.

## Affected paths

- `src/lib/recharts.tsx`
- Chart components, each split into a lazy wrapper (original path) and a `*-content.tsx` holding the implementation: `marketing-trend-chart`, `asset-bar-chart`, `category-breakdown`, `planner-results`, `dividend-income-chart`, `expense-chart`, `salary-chart`.
- `test/components/chart-size-warning.test.tsx`, `test/components/chart-lazy-placeholder.test.tsx` (new)
- `test/stubs/next-dynamic.tsx` (comment only), `vitest.config.ts` (alias to the next/dynamic stub, from the earlier commit on this branch)

## Change

- Primitives are re-exported statically from `recharts`; `Cell` stays static as before, so per-bar colors and displayName matching are unchanged.
- `ResponsiveContainer` is a client wrapper (`'use client'`) around the recharts one. It renders a `h-full w-full min-w-0` div, tracks that div with a `ResizeObserver` (disconnected on unmount), and mounts the recharts container only while the div measures above zero on both axes. The recharts container also gets `initialDimension` `1 x 1` (callers may override) so its first render does not warn. The gate is needed because a `display:none` ancestor, such as a hidden tab, always measures 0x0 and `minWidth`/`minHeight` cannot fix that.
- The wrapper fills its parent, so every call site must give the parent a definite height. All seven do: `h-[320px]`, `h-[400px]` (asset line chart, previously `h-full min-h-[400px]`, which could collapse to 0 under the gate), `h-[120px]`, `h-[250px]`, `h-[260px]`, `h-[240px] sm:h-[350px]`, `h-[350px]`.
- The lazy boundary moves up one level: each chart's original module is a `next/dynamic({ ssr: false })` wrapper around its `*-content.tsx`. Importers and barrels are unchanged, and recharts still loads outside the initial JS, in one chunk per chart.
- Each lazy wrapper passes a `Skeleton` as `loading` so the swap-in shifts less. The dynamic boundary replaces the whole component, so the skeleton height is the chart div's height plus the chrome that component renders around it. Allowance derivation from the markup: `Card` is `py-6 gap-6` plus a border (about 74px) and a title with description adds about 42px, giving 116px for `marketing-trend-chart`, `asset-bar-chart`, `salary-chart` and `category-breakdown`. `expense-chart`'s header also holds an anomaly review and a 12-month total block: about 164px beside each other from `sm`, about 256px stacked below it. `dividend-income-chart` and `planner-results` render no Card (callers wrap them: `distributions-section`, `dividend-summary`, `salary-planner`, `scenario-dialog`), so their allowance is 0. `planner-results` stacks its chart and summary below `sm`, so its mobile skeleton is 474px (250 chart, 24 gap, about 200 summary) and 250px from `sm`.
- These values are estimates from the markup, not measurements. `category-breakdown` also renders a variable-length category list that the allowance does not cover, so some shift remains there.
- The asset line chart parent changed from `h-full min-h-[400px]` to `h-[400px]`, so it no longer stretches to fill a taller sibling row in the `lg:grid-cols-3` layout on the assets page.
- `CHART_AXIS_TICK_PROPS` and `CHART_TOOLTIP_PROPS` are unchanged, so dark-mode tick and tooltip theming is preserved.

## Acceptance checks

- Regression tests: the stock container warns; the `@/lib/recharts` container does not, including when mounted under a hidden parent and revealed later; the observer is disconnected on unmount; each lazy wrapper is `ssr: false` with a skeleton of the expected height.
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green. Three profile statement tests timed out once under full-suite load and pass alone.
- Per-route JS was not compared against a base build, so no per-route size claim is made. Total chunk size after the change is 3122kB.

## Rollback

Revert the implementing commit; no data, schema or dependency change is involved.

## Residual risk

- Charts no longer render their surrounding card on the server; the whole card appears after the chart chunk loads, behind a skeleton whose height is an estimate (see Change).
- A caller that gives the wrapper's parent an auto height gets no chart, because the wrapper stays at 0. Call sites are checked above; new ones must follow the same rule.
- The placeholder test loads each wrapper through a static loader map so Vite prints no dynamic-import-vars warning.
