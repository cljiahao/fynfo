---
id: 061
slug: app-semantic-token-system
area: feature
status: shipped
author: Claude (Opus 4.8)
created: 2026-07-04
approved: 2026-07-04
shipped: 2026-07-04
impl_pr: (direct to main)
supersedes:
constitution_satisfies:
  - '§1.1'
constitution_overrides:
---

# Spec 061: Authenticated-app semantic token system

## Problem

Fynfo has a split visual identity. The marketing storefront (`features/marketing/*`)
is deliberately designed — Fraunces display, an emerald→sky brand gradient, glass,
motion. The authenticated app behind the login is the untouched shadcn `neutral`
base (monochrome grey/black/white) with financial gain/loss colours bolted on as
raw Tailwind utilities (`text-emerald-500`, `text-red-500`, `bg-green-100`). The two
share no colour DNA, and the raw-utility layer is the source of real bugs:

- `features/assets/components/asset-bar-chart.tsx:49` draws the "Total Assets" line
  as `#171717` — invisible against the dark canvas (`--background` ≈ `#101010`).
- Light-only badges with no dark variant wash out in dark mode:
  `features/expenses/components/expense-quick-add.tsx:183` (`bg-green-100 text-green-700`),
  `features/equity/components/trade-table.tsx:122-123` (`bg-emerald-100`/`bg-red-100`).
- ~15 files hardcode `text-emerald-*` / `text-red-*` for gain/loss — no semantic
  token exists (`--destructive` is the only chromatic token and is bypassed).
- Chart series colours are hardcoded, theme-blind hex — axes/tooltips adapt to the
  theme (`src/lib/recharts.ts`) but the data marks do not.
- `.brand-gradient` (`globals.css:176-182`) is `from-primary via-primary to-primary`
  — a one-colour "gradient" (no-op).
- In dark mode `--card == --background` (both near-black) — cards have no surface
  depth.
- Financial state is communicated by colour alone in tables (no shape/icon), and
  borderline WCAG-AA contrast on emerald KPI numbers.

Design approved via an Artifact preview (calm + shared-DNA direction): carry one
thread of the marketing emerald→sky gradient inward, split into meaning.

## Constitution check

- Satisfies: `§1.1` (personal wealth dashboard — usability, trust, legibility).
- Overrides: none.
- Style rules honoured (`AGENTS.md §4`): Tailwind classes / theme tokens only, no
  new inline styles (existing data-driven inline styles for dynamic width/hex chart
  swatches are retained — they are value-bound, not static styling); static colour
  data stays in `constants.ts`.

## Solution shape

Tailwind v4 CSS-first; all tokens live in `src/app/globals.css` (`:root` + `.dark`,
exposed via `@theme inline`). No dependency change.

### Phase A — token foundation (`src/app/globals.css`)

Add semantic tokens (light + dark values, exact OKLCH from the approved preview):

- **Brand accent** — `--brand`, `--brand-foreground`, `--brand-subtle`. Sky end of
  the marketing gradient. Used sparingly: links, active nav underline, focus `--ring`,
  selected/active state, primary chart series. Primary buttons stay monochrome
  (calm direction). Light `oklch(0.55 0.13 240)` / dark `oklch(0.7 0.13 240)`.
- **Gain** — `--gain`, `--gain-strong` (text-contrast-safe), `--gain-subtle` (badge
  tint). Emerald `oklch(0.55 0.14 158)` / dark `oklch(0.74 0.15 158)`.
- **Loss** — `--loss`, `--loss-strong`, `--loss-subtle`. Red family (aligns with
  `--destructive`).
- **Warning** — `--warning`, `--warning-subtle`. Amber.
- **Chart ramp** — `--chart-1`…`--chart-6`, theme-aware, derived from brand/gain/
  warning + analogous hues; distinct for colour-vision deficiency.
- **Neutral bias** — shift the pure-grey neutrals (`--muted`, `--muted-foreground`,
  `--border`, `--input`, `--ring`) to a faint cool chroma (~hue 240) so they read
  chosen, not defaulted.
- **Dark card depth** — lift `--card`/`--popover` slightly above `--background` in
  `.dark` only.
- Point `--ring` at `--brand`.
- Map all new tokens through `@theme inline` (`--color-brand`, `--color-gain`, etc.)
  so `bg-gain-subtle` / `text-gain` / `text-loss` utilities exist.
- Remove the hollow `.brand-gradient` / `.text-brand-gradient` no-op utilities (or
  repoint `BrandText` — see Out of scope); the real marketing gradient is untouched.

### Phase B — adoption sweep + bug fixes

Replace raw utilities with the new tokens across the authed app. Reference set from
the audit (not exhaustive; grep-driven):

- Gain/loss text: `assets/summary-cards.tsx`, `equity/portfolio-summary.tsx`,
  `equity/holdings-table.tsx`, `salary/salary-summary.tsx`,
  `salary/salary-summary-cards.tsx`, `assets/planner-results.tsx`,
  `assets/deployable-cash-breakdown.tsx`, `expenses/owed-summary.tsx`,
  `equity/yield-on-cost-table.tsx` → `text-gain` / `text-loss`.
- Delete-icon buttons (`text-red-500`) → `text-destructive`: `salary-table.tsx`,
  `snapshot-table.tsx`, `dividend-table.tsx`, `trade-table.tsx`, `snapshot-form.tsx`,
  `split-dialog.tsx`, `editable-expense-row.tsx`; log-out `text-red-600`
  (`user-menu-dropdown.tsx`) → `text-destructive`.
- Washed badges → `bg-gain-subtle text-gain-strong` / `bg-loss-subtle text-loss-strong`
  (`expense-quick-add.tsx:183`, `trade-table.tsx:122-123`).
- Hardcoded blue/violet accents (`market-deployment-card.tsx`,
  `market-allocation-table.tsx`) → chart/brand tokens.
- **Chart bug**: `asset-bar-chart.tsx:49` `#171717` → `var(--foreground)` (or
  `--chart-*`). Migrate `CATEGORY_COLORS` (`assets/constants.ts`),
  `EXPENSE_TYPE_COLORS` (`expenses/constants.ts`), and inline chart literals
  (`salary-chart.tsx`, `admin/marketing-trend-chart.tsx`, `expense-chart.tsx`
  ReferenceLine) to reference the `--chart-*` CSS variables so marks adapt to theme.

### Phase D — a11y pairing (folded in where a cell is already edited)

- Pair financial colour with a shape/glyph in table cells and pills (▲/▼ or icon),
  not colour alone — `portfolio-summary`, `holdings-table`, `salary-summary`,
  `owed-summary`. KPI cards already pair arrows; extend the pattern.
- Add `tabular-nums` (Tailwind `tabular-nums`) to money columns/figures.
- Verify `--gain-strong`/`--loss-strong` meet WCAG AA on card/background for text use.

## Out of scope

- **Phase C (component altitude)** — KPI-card / page-header redesign, type-scale
  overhaul, motion. Tracked as a fast-follow spec (062); this spec is tokens +
  adoption + bug/a11y fixes only.
- Marketing/storefront surfaces (already designed) — untouched.
- The vault-unlock lock screen's bespoke dark palette (`vault-unlock-flow.tsx`) —
  intentional; deferred.
- `BrandText` gradient revival — decide in 062; for now it renders solid `--primary`
  as today (removing the no-op util must not visually regress it).
- No layout/structure changes; no new shadcn primitives; no dependency.

## Acceptance

- [ ] `pnpm check` green (format:check + lint max-warnings=0 + typecheck)
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Grep shows no `text-emerald-`, `text-red-[0-9]`, `bg-green-1`, `bg-emerald-1`,
      `bg-red-1` remaining in `src/features/**` / `src/components/**` (except
      `features/marketing/**` and intentional `--destructive` mappings)
- [ ] Manual (light + dark): asset bar-chart total line visible in both themes;
      expense/trade badges legible in dark; gain/loss consistent app-wide; cards
      read as surfaces in dark mode; focus rings show the brand accent
- [ ] Manual: money columns use tabular figures; table gain/loss cells pair a glyph
      with colour
- [ ] Spec hash unchanged since approval

## Risk & reversibility

- **Blast radius**: presentation only — every authed page's colours. No data, no
  crypto, no server actions touched. Token rename could miss a call-site (caught by
  the grep gate + manual dark-mode pass).
- **Reversibility**: single `git revert` (CSS + className edits only).
- **Backout plan**: revert the commit; tokens are additive so a partial revert of
  `globals.css` is safe.

## Open questions

- [x] Q: Remove `.brand-gradient` utility outright, or keep as a real emerald→sky
      gradient for `BrandText`? — Owner: Clarence — A: removed the dead util;
      `BrandText` / login / navbar "Fyn" now use `text-primary` (visually unchanged);
      real gradient revisited in 062.

## Implementation notes (2026-07-04)

Refinements made during build, within spec intent:

- **Categorical vs emphasis chart colours.** `CATEGORY_COLORS` (7) and
  `EXPENSE_TYPE_COLORS` (14) legitimately need many _distinct_ hues — collapsing
  them into the 6-token ramp would destroy category separation. So they stay as
  explicit hex (correct categorical design, not debt); only the one theme-unsafe
  value (`pension #92400e`, invisible-dark brown) was lightened to `#b45309`. The
  `--chart-*` ramp + `var(--foreground)`/`--muted-foreground` were applied to the
  _emphasis / small-multiseries_ charts that were genuinely theme-blind:
  `asset-bar-chart` aggregates (the `#171717` bug), `salary-chart`,
  `marketing-trend-chart`, and the `expense-chart` reference line.
- **Added `--warning-strong`** (+ `--color-warning-strong`) for text-on-tint
  contrast, mirroring the gain/loss `-strong` pattern (amber badge cell +
  `investment-breakdown` warning banner).
- **Phase D** landed a representative pass (`holdings-table`: directional ▲/▼ glyph
  - `tabular-nums`). Comprehensive glyph/tabular-nums across all tables folds into
    spec 062 (component elevation); KPI/P&L cards already carry +/− signs and arrows.
- **Test update**: `investment-math.test.ts` `deployPctColor` assertions updated to
  the semantic token strings.

Gates: `format:check` + `lint` + `typecheck` + `test:ci` (462) + `build` all green.
