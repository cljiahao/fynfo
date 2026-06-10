---
id: 004
slug: storefront-moat-telemetry-admin
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-11
approved: 2026-06-11
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes:
depends_on: specs/governance/013-telemetry-write-exception.md # MUST be approved + constitution bumped first
constitution_satisfies:
  - '§2.4' # pages compose features
  - '§2.5' # server components by default
  - '§2.6' # barrel exports
  - '§2.7' # named exports
  - '§5.2' # RLS + policy in same migration
  - '§6.3' # forward-only migration
constitution_overrides: # HARD changes are handled by gov-013, NOT per-spec overrides
  - section: '§2.2'
    reason: 'Anonymous telemetry ingestion via /api/track is only legal AFTER gov-013 amends §2.2 to add it to the reserved API-route list. This spec does not override §2.2 itself; it depends on the amendment.'
  - section: '§2.3'
    reason: 'Admin aggregate read + anonymous telemetry touch no encrypted payload and have no vault. Legal only AFTER gov-013 clarifies §2.3 scope. Depends on the amendment.'
---

# Spec 004: Storefront moat band + self-hosted aggregate telemetry + admin dashboard

## Problem

Fynfo is live but the home page positions it as "completely free, no premium tiers" and gives a visitor no crisp "why this over a spreadsheet / Mint / YNAB" reason. There is also zero visibility into whether anyone visits, clicks the CTA, or signs up. Before any future monetisation decision, Clarence needs (a) an upsell/moat section that converts visitors to signups, and (b) a private admin view of visits, click-through rate, and signups. No billing in this round.

## Constitution check

- Satisfies: `§2.4`, `§2.5`, `§2.6`, `§2.7`, `§5.2`, `§6.3`.
- **HARD-rule dependency:** anonymous telemetry writes conflict with `§2.2` ("no /api mutation routes" — reserved list) and `§2.3` ("public actions don't exist; every action requires `requireUserId()` + `getVaultDekSession()`"). Per `§7.2`, HARD rules cannot be overridden per-spec. This spec is BLOCKED until **`specs/governance/013-telemetry-write-exception.md`** is approved and `CONSTITUTION.md` is bumped to add a scoped telemetry exception. Part A (below) is independent of the amendment and may ship first.

## Solution shape

Three parts. Part A has no governance dependency; Parts B & C require gov-013.

### Part A — Home page moat/upsell (no governance dependency)

- `src/features/marketing/constants.ts`: add `MOAT_POINTS` (3 cards, led by **best-effort-by-design**; must NOT duplicate `SecurityBand`'s encryption/ownership copy). Edit `FAQ_ITEMS`: soften "Is Fynfo free?" → "Free during early access"; add a "Why no bank sync?" Q&A reinforcing the best-effort positioning.
- `src/features/marketing/components/moat-band.tsx`: new `MoatBand` server component, dark-token styling consistent with `FeatureGrid`/`SecurityBand`, uses `Reveal`. Driven by `MOAT_POINTS`.
- `src/features/marketing/index.ts`: export `MoatBand`.
- `src/app/(public)/page.tsx`: render `<MoatBand />` between `FeatureGrid` and `SecurityBand`.

### Part B — Self-hosted aggregate telemetry (requires gov-013)

- **Migration** `supabase/migrations/20260611000000_add_marketing_telemetry.sql` (forward-only, `§6.3`):
  - Table `public.marketing_events (id uuid pk default gen_random_uuid(), event_type text not null, path text not null, created_at timestamptz not null default now())`. **No `user_id`, no IP, no user-agent, no PII** (privacy decision: aggregate counts only).
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (`§5.2`).
  - INSERT policy `TO anon, authenticated WITH CHECK (event_type IN ('page_view','cta_click') AND char_length(path) <= 128)` — a real policy, not `GRANT ALL` (`§5.2`).
  - SELECT policy `TO authenticated USING (true)` — aggregate counts are non-PII; the real admin gate is the app layer (see Part C residual risk).
  - `SECURITY DEFINER` function `get_signup_stats()` returning total signup count + daily series from `users_profile.created_at` (needed because `users_profile` RLS is own-row; an admin session cannot count all users). `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`. Pattern mirrors `vault_unlock_*` definer functions.
- **Ingestion** `src/app/api/track/route.ts`: `POST`, wrapped in `withLogging('api.track', ...)`. Zod body `{ eventType: 'page_view' | 'cta_click', path: string (<=128) }`. On invalid → 400 with `z.flattenError`. Inserts one row via the (anon) server Supabase client. Opaque errors only (`§5.4` posture). This is the new reserved API route gov-013 authorizes.
- `src/lib/constants/routes.ts`: add `TRACK: '/api/track'` to `API_ROUTES`.
- **Client beacons** in `features/marketing`: a small `'use client'` `PageViewTracker` (fires one `page_view` on mount via `fetch(..., { keepalive: true })`) mounted on the public home page; CTA click handlers on the Hero + CtaBand "Get started" links fire `cta_click` (non-blocking beacon, navigation not delayed). `'use client'` justified: browser-only beacon + event handlers.

### Part C — Admin dashboard (page mechanics independent; data requires Part B)

- `src/lib/admin.ts`: pure helpers `parseAdminUserIds(raw?: string): string[]` and `isAdminUser(userId: string, raw?: string): boolean`. Unit-tested.
- `src/features/admin/lib/get-marketing-stats.ts`: server-only read. `requireUserId()` → `isAdminUser(id, process.env.ADMIN_USER_IDS)` (else throw/`notFound`) → reads `marketing_events` aggregates + `rpc('get_signup_stats')`. Computes `clickRate = ctaClicks / pageViews` via a pure `computeClickRate(views, clicks)` helper (unit-tested; guards divide-by-zero).
- `src/features/admin/components/*`: stat cards (views, CTA clicks, click-rate %, signups) + one recharts trend component (views vs clicks daily) reusing `@/lib/recharts` + `CHART_AXIS_TICK_PROPS` + the dark-mode tooltip pattern from `expense-chart.tsx`.
- `src/features/admin/index.ts`: barrel.
- `src/app/dashboard/admin/page.tsx`: thin RSC (`§2.4`), `export const dynamic = 'force-dynamic'`, gates via the feature read fn and composes the feature components. No vault/PIN (reads no encrypted data).
- **Env**: new `ADMIN_USER_IDS` (comma-separated Supabase user UUIDs). Added to `.env.example` + local `.env` + Vercel **by Clarence** (path-guard blocks agent edits to `.env*`; `§5.3`).

## Out of scope

- Stripe / billing / paywall / subscription tables (deferred — separate future spec).
- Unique-visitor counts, sessions, referrer/UTM (privacy decision: aggregate counts only).
- Bank sync, multi-currency (explicitly rejected; this is the moat copy, not a feature).
- Admin nav link in the user menu (reachable by `/dashboard/admin` URL; conditional client gating out of scope).
- Vercel / third-party analytics.

## Acceptance

- [x] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [x] `pnpm test:ci` green (281 tests); new tests cover `parseAdminUserIds`/`isAdminUser`, `computeClickRate` (incl. zero-views), and the `/api/track` Zod schema (reject bad eventType, over-length path)
- [x] `pnpm build` green (`/api/track` + `/dashboard/admin` routes emitted)
- [x] gov-013 approved + `CONSTITUTION.md` bumped to v2.0
- [x] Migration `20260611000000_add_marketing_telemetry.sql` applied to Supabase (2026-06-11)
- [ ] **Pending Clarence:** set the admin allowlist env (now `ADMIN_EMAILS` per spec 005, which supersedes the `ADMIN_USER_IDS` gate) in local `.env` / Vercel
- [ ] Manual (post-deploy): home shows `MoatBand`; FAQ updated; CTA + page load record rows in `marketing_events`; `/dashboard/admin` shows stats for an `ADMIN_USER_IDS` user and 404s for a non-admin
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius:** new table + one anon-writable route + one new protected page. No change to encrypted financial data paths, auth, or the vault. `marketing_events` is isolated.
- **Reversibility:** Part A = single git revert. Part B/C = git revert + a follow-up forward-only migration dropping `marketing_events` and `get_signup_stats()` (no rollback of forward-only history, `§6.3`).
- **Backout plan:** revert the impl commit; if migration applied, ship a forward `drop` migration. `ADMIN_USER_IDS` unset → admin page 404s for everyone (fails closed).

## Open questions

- [x] Q: API route vs server action vs client rpc for ingestion? — Owner: Clarence — A: `/api/track` route, authorized by gov-013 (server-mediated, Zod-validated, `withLogging`; keeps a single auditable gate, §2.2 spirit).
- [x] Q: visitor granularity? — Owner: Clarence — A: aggregate counts only, no identifiers.
- [ ] Q: telemetry spam — anon can POST `/api/track` arbitrarily, inflating counts. Owner: Clarence. A (proposed): accept for now (counts are directional, not billing); revisit with a coarse rate-limit if abused. Note in PR.
