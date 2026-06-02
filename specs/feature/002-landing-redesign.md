---
id: 002
slug: landing-redesign
area: feature
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # owner approved design (premium dark, dark-always) in brainstorming
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.1' # page composes from feature components; thin page
constitution_overrides:
---

# Spec feature/002: Landing page redesign (premium dark)

## Problem

The marketing home page (`(public)/page.tsx`) is generic and flat — a centered text hero, plain white
feature cards, no motion (despite `framer-motion` being installed), no product preview, no depth. It
does not convey that Fynfo is a polished, zero-knowledge wealth product. It also carries **stale
copy**: the FAQ claims JSON import (not a feature) and lists brokers "Tiger Brokers … IBKR" when the
app only supports DBS Vickers + Moomoo.

## Constitution check

- Satisfies `§4.1` (thin page composing feature components). Overrides: none. **No new dependency**
  (`framer-motion`, shadcn, Tailwind already present). No backend/encryption/data change — presentation
  only.

## Solution shape

Premium **dark-always** marketing page (self-contained dark classes, independent of the app's
light/dark toggle), built with the `frontend-design` skill for distinctive markup.

- New feature `src/features/marketing/`:
  - `constants.ts` — `FEATURES`, `FAQ_ITEMS` (corrected copy), trust badges.
  - `components/reveal.tsx` — small `'use client'` framer-motion wrapper (fade/rise `whileInView`,
    honors `prefers-reduced-motion`).
  - `components/hero.tsx` — dark mesh-gradient hero, eyebrow pill, gradient headline, CTAs, staggered
    load animation.
  - `components/dashboard-preview.tsx` — code-built glassy mock (mini net-worth area chart + stat
    cards, realistic static numbers). No screenshot, no real data.
  - `components/feature-grid.tsx` — dark glass feature cards, scroll-reveal stagger.
  - `components/security-band.tsx` — zero-knowledge USP band ("encrypted before it leaves your device").
  - `components/faq.tsx` — dark accordion (reuses shadcn `Accordion`), corrected answers.
  - `components/cta-band.tsx` — brand-gradient CTA panel.
  - `index.ts` barrel.
- `(public)/page.tsx` becomes a thin server component composing the above.
- `components/layout/navbar.tsx` — public (`!isDashboard`) variant restyled to dark glass
  (transparent over hero, blur). Dashboard navbar untouched.
- `components/layout/site-footer.tsx` — dark variant on public pages.

## Out of scope

- Login page, dashboard, the app theme/token system (toggle behavior unchanged).
- Real screenshots or live data in the preview (static mock only).
- Copy/SEO overhaul beyond fixing the stale FAQ claims.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] jsdom smoke tests: hero renders the headline + a "Get Started" link to `/login`; FAQ contains no
      "Tiger"/"IBKR"/"import … JSON" claims and does mention "DBS Vickers"/"Moomoo".
- [ ] Landing is dark regardless of the app theme toggle; navbar/footer match on public routes.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: public marketing routes only (landing + the public navbar/footer variant). No
  authenticated app surface, data, or encryption touched.
- **Reversibility**: `git revert` (restores the old page + navbar/footer).
- **Backout plan**: revert the commit.

## Open questions

- None (direction = premium dark; dark-always; landing-only — confirmed with owner).
