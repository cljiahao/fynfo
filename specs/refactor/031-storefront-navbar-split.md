---
id: 031
slug: storefront-navbar-split
area: refactor
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-13
approved: 2026-06-13
shipped: 2026-06-14
impl_pr: # direct-to-main per solo-project workflow
supersedes:
constitution_satisfies:
  - '§2.4' # pages/layouts compose; no data fetch in layout
  - '§2.5' # Server Components by default — public navbar becomes server
  - '§2.6' # barrel export surface updated
  - '§2.7' # named exports
  - '§4.5' # performance budget — shrink storefront client JS
constitution_overrides: # none
---

# Spec 031: Split Navbar into a server PublicNavbar + client DashboardNavbar

## Problem

The storefront (`/`, `/login`) is the page we most want fast for first-time visitors, but it currently ships client JS it never renders. `src/components/layout/navbar.tsx` is a single `'use client'` component that branches on `usePathname()`: a static public navbar OR an authenticated navbar with a radix `Sheet` (dialog) mobile menu, `useState`, the `Menu` icon, and active-link logic. Because the dashboard branch is imported at module level, the **public route bundle includes the radix Sheet/Dialog + `useState` + `Menu` + `usePathname` code even though public pages never render any of it.** The public navbar has no interactivity at all (just links) and should be a Server Component shipping zero JS.

This is the one clean, low-risk load-speed win surfaced by the perf investigation. (The other agent-flagged "high-impact waterfalls" did not survive code reading: the `SalaryPlanner` React Query hooks already run concurrently, and the `InvestmentAllocation` trades→prices dependency is inherent to vault-encrypted tickers and cannot be prefetched server-side without the DEK. framer-motion is the dominant storefront dep but is load-bearing for the above-the-fold Hero animation — out of scope.)

## Constitution check

- Satisfies: `§2.4`, `§2.5` (the core: public navbar drops `'use client'`), `§2.6`, `§2.7`, `§4.5`.
- Overrides: none.
- No `HARD` rule touched. No governance amendment required. No enforcement-layer (`.claude/**`) or secret file touched. No new dependency.

## Solution shape

Split the one branching client component into two single-purpose components, each mounted by the layout that needs it. No behavior change on the dashboard; the public navbar renders identical markup with zero client JS.

- **New `src/components/layout/public-navbar.tsx`** — Server Component (no `'use client'`). The current `!isDashboard` branch markup verbatim (brand wordmark, Features / FAQ / Get-started links). Drop the `onClick={() => window.scrollTo(...)}` on the brand link — it required client JS for a nicety Next already covers (navigating to `/` scroll-restores to top). No `usePathname` (it only renders on public routes). Named export `PublicNavbar`.
- **New `src/components/layout/dashboard-navbar.tsx`** — `'use client'` (justified: `usePathname` active-link highlight + `useState` mobile `Sheet`). The current `isDashboard` branch verbatim, keeping the `userMenu?: React.ReactNode` prop, `NAV_ITEMS`, active-link logic, and mobile Sheet. Named export `DashboardNavbar`.
- **Delete `src/components/layout/navbar.tsx`** (the combined component) once both callers move.
- **`src/components/layout/index.ts`** — replace `export { Navbar } from './navbar'` with `export { PublicNavbar } from './public-navbar'` and `export { DashboardNavbar } from './dashboard-navbar'`.
- **`src/app/(public)/layout.tsx`** — `<Navbar />` → `<PublicNavbar />`.
- **`src/app/dashboard/layout.tsx`** — `<Navbar userMenu={<UserMenu />} />` → `<DashboardNavbar userMenu={<UserMenu />} />`.
- No encryption-touching paths. No migration. No data-fetch added to any layout (§2.4 preserved).

## Out of scope

- Removing redundant `'use client'` from pure-presentational components (`summary-cards.tsx`, `salary-summary-cards.tsx`) — these sit under client parents so they yield no bundle delta; deferred to the planned code-debt spec.
- framer-motion / Hero animation changes (load-bearing design choice).
- The `InvestmentAllocation` / `SalaryPlanner` data-flow (not actual waterfalls — see Problem).
- templateCentral 5.0.x harness drift (harness floor 4→5, flat-skill→`SKILL.md` dir, `.agents` gitignore, harness.json regen) — enforcement-layer, human-only; flagged separately to Clarence.
- Any new nav links, styling changes, or mobile-menu redesign.

## Acceptance

- [x] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [x] `pnpm test:ci` green (285 tests; no test change — navbar is presentational)
- [x] `pnpm build` green; no remaining import of the deleted `navbar.tsx` (`/` prerenders static ○)
- [ ] Manual (post-deploy): `/` and `/login` render the public navbar identically (brand, Features, FAQ, Get started); brand link still navigates home
- [ ] Manual (post-deploy): dashboard navbar unchanged — active-link underline tracks route, mobile Sheet opens/closes, UserMenu present
- [x] Verify (source): `public-navbar.tsx` is a Server Component and imports no radix `Sheet`/`Dialog`, `useState`, or `Menu`
- [x] Spec hash matches at impl time (single-session impl)

## Risk & reversibility

- **Blast radius:** navbar rendering on every route. Purely presentational; no auth, vault, data, or encryption path touched.
- **Reversibility:** single `git revert` (restore `navbar.tsx` + barrel + two layout lines).
- **Backout plan:** revert the impl commit. No migration, no env, no state to unwind.

## Open questions

- [x] Q: Drop the brand-link `window.scrollTo` on the public navbar? — Owner: Clarence — A (proposed): yes; it's the only thing forcing the public navbar client, and Next handles scroll-to-top on navigation. Flag if you want it kept (would require a tiny client island).
