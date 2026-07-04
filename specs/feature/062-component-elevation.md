---
id: 062
slug: component-elevation
area: feature
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

# Spec 062: Component elevation — StatCard, PageHeader, wordmark

## Problem

Fast-follow to spec 061 (token system). Two patterns are copy-pasted at
default-shadcn altitude across the dashboard:

- The KPI card (`Card > CardHeader[title + top-right icon] > CardContent[text-2xl
bold + muted hint]`) — the stock shadcn "dashboard-01" block — is duplicated in
  `assets/summary-cards.tsx`, `salary/salary-summary-cards.tsx`,
  `equity/portfolio-summary.tsx`, `admin/stat-cards.tsx` (and the overview reuses
  them). Same markup, five times, no shared component.
- The page header (`flex-between > [h1.text-3xl + muted <p>] + <action>`) is
  repeated verbatim in all 8 dashboard pages.

Both are generic admin-template altitude, and the duplication is real debt. 061
also left the `BrandText` wordmark rendering flat (the hollow gradient util was
removed); the shared-DNA signature is missing.

## Constitution check

- Satisfies: `§1.1` (usability, visual identity, trust).
- Overrides: none. Style rules honoured (`AGENTS.md §4`): named exports, Tailwind
  tokens, barrel export via `components/widgets/index.ts`.

## Solution shape

### New shared widgets (`src/components/widgets/`)

- **`StatCard`** — replaces the duplicated KPI block. Props:
  `label: string`, `value: ReactNode`, `icon?: LucideIcon`,
  `tone?: 'default' | 'gain' | 'loss'` (colours the value),
  `trend?: 'up' | 'down'` (renders a gain/loss arrow chip instead of the plain
  icon), `hint?: ReactNode`, `children?: ReactNode` (optional breakdown rows).
  Elevation: icon in a `bg-brand-subtle text-brand` rounded chip, `tabular-nums`
  value, consistent hierarchy. **No decorative trend rail** (it encoded no data).
- **`PageHeader`** — props `title: string`, `description?: string`,
  `action?: ReactNode`. One consistent `flex-between` + `h1` type treatment.

### Adoption

- Rewrite the 4 KPI files onto `StatCard` (portfolio-summary passes SG/US
  breakdown rows as `children`).
- Replace the header block in the 8 dashboard pages with `<PageHeader>`.
- `tabular-nums` on money columns in the remaining tables (`salary-table`,
  `trade-table`, `dividend-table`, `snapshot-table`, `yield-on-cost-table`,
  `monthly-investment-table`, `market-allocation-table`, `owed-summary`).

### Wordmark (`src/app/globals.css`)

- Reintroduce `.text-brand-gradient` as a **real** gradient
  (`bg-linear-to-r from-brand to-gain bg-clip-text text-transparent` — sky→emerald,
  echoing the storefront). Repoint `BrandText`, `login-card`, `dashboard-navbar`
  "Fyn" back to it.

## Out of scope

- Page layout / grid structure — unchanged.
- Motion / animation — deferred.
- Vault-unlock lock screen — still deferred (per 061).
- No new shadcn primitive, no dependency.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] KPI cards render via `StatCard`; 8 pages render via `PageHeader`; no
      duplicated header/KPI markup remains
- [ ] Manual (light + dark): KPI icon chips show the brand accent; wordmark shows
      the sky→emerald gradient; money columns are tabular

## Risk & reversibility

- **Blast radius**: presentation/markup only — no data, crypto, or actions.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit; widgets are additive.

## Open questions

- none.

## Implementation notes (2026-07-05)

- **`portfolio-summary` kept custom** (not migrated to `StatCard`). Its four cards
  carry loading/error states and SG/US breakdown sub-rows; forcing them through
  `StatCard` would bloat the widget's API. `StatCard` stays a simple single-stat
  primitive (one clear purpose); `portfolio-summary` got `tabular-nums` on its
  headline values instead. `StatCard` adopted by `summary-cards`,
  `salary-summary-cards`, `admin/stat-cards`.
- **`PageHeader`** adopted across all 8 surfaces (household's local `Header` helper
  removed as now-dead).
- Gates: `format` + `lint` + `typecheck` + `test:ci` (462) + `build` green.
