---
id: 034
slug: storefront-lazymotion
area: refactor
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-14
approved: 2026-06-14
shipped: 2026-06-14
impl_pr: # direct-to-main per solo-project workflow
supersedes:
constitution_satisfies:
  - '§2.5' # smaller client bundles
  - '§2.7' # named exports
  - '§4.5' # performance budget — < 200KB JS/route; trim storefront critical path
constitution_overrides: # none
---

# Spec 034: Storefront framer-motion → LazyMotion + `m` (trim landing critical path)

## Problem

The storefront's largest client dependency is `framer-motion` (12.38.0). Both motion-using files — `hero.tsx` (above the fold) and `reveal.tsx` (scroll-reveal wrapper used by every marketing section) — import the full `motion` component, which ships framer-motion's **entire ~34KB feature bundle** (animations + layout + drag + gestures) on the landing critical path. Hero animates on mount, so this bundle is unavoidable today even though the page uses only a small subset of features. Per the framer-motion docs, swapping the full `motion` for the lightweight `m` component under a `LazyMotion` boundary loading only `domAnimation` drops the baseline from ~34KB toward ~4.6KB + the `domAnimation` feature set, cutting the storefront's JS without changing any animation behavior.

Researched 2026-06-14: [Motion — Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size), [LazyMotion](https://motion.dev/docs/react-lazy-motion). The features in use (`animate`, `variants`, `whileInView`, `initial`, `useReducedMotion`) are all covered by `domAnimation`; no `drag`/`layout` is used, so `domAnimation` (not `domMax`) suffices.

## Constitution check

- Satisfies: `§2.5`, `§2.7`, `§4.5`.
- Overrides: none. No `HARD` rule touched. **No new dependency** — `LazyMotion`, `m`, and `domAnimation` are exports of the already-installed `framer-motion`. No enforcement-layer or secret file touched.

## Solution shape

One `LazyMotion` boundary wrapping the marketing page tree, plus `motion.*` → `m.*` in the two motion files. `strict` mode makes any stray `motion` usage throw, guarding against regressions.

- **New `src/features/marketing/components/motion-provider.tsx`** (`'use client'`): exports `MotionProvider` = `<LazyMotion features={domAnimation} strict>{children}</LazyMotion>`. `features={domAnimation}` is loaded synchronously (no async chunk) so the above-the-fold Hero animates with no flash. Named export.
- **`src/features/marketing/components/hero.tsx`**: import `m` (and keep `useReducedMotion`, `type Variants`) from `framer-motion`; replace `motion.div`/`motion.h1`/`motion.p` with `m.div`/`m.h1`/`m.p`. Keeps `'use client'`.
- **`src/features/marketing/components/reveal.tsx`**: import `m` from `framer-motion`; `motion.div` → `m.div`.
- **`src/features/marketing/index.ts`**: export `MotionProvider`.
- **`src/app/(public)/page.tsx`**: wrap the `Hero … CtaBand` content in `<MotionProvider>` (all `m`/`Reveal` users — Hero + every section — render inside it). `PageViewTracker` stays outside (no motion). The `/login` page is unaffected (no motion users).

## Out of scope

- Async-loading `domAnimation` via dynamic import (max bundle cut but risks an above-the-fold animation flash on Hero — not worth it for the storefront's first paint).
- Replacing framer-motion with CSS animations (larger redesign; the LazyMotion path gets most of the win with zero behavior change).
- Enabling the Next.js 16 React Compiler / adding `@next/bundle-analyzer` (config + dependency changes — separate specs).
- Dashboard / authenticated routes (no motion users there).

## Acceptance

- [x] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [x] `pnpm test:ci` green (291); `hero.test.tsx` wrapped in `MotionProvider`, passes
- [x] `pnpm build` green; `/` still prerenders static
- [ ] Manual (post-deploy): Hero entrance animation + scroll-reveal on sections behave identically; reduced-motion still collapses to no-op
- [x] Verify: no remaining `import { motion }`/`motion.` JSX in `src/features/marketing` (all `m`); `strict` LazyMotion present
- [x] Spec hash matches at impl time (single-session impl)

## Risk & reversibility

- **Blast radius:** storefront marketing components only. Animation semantics unchanged (`m` is the same renderer as `motion`, just without preloaded features). `strict` throws at dev/test if a `motion` usage is missed — caught by gates, not in prod silently.
- **Reversibility:** single `git revert`.
- **Backout plan:** revert the impl commit.

## Open questions

- [x] Q: `domAnimation` vs `domMax`? — Owner: Clarence — A: `domAnimation` — no drag/layout animations are used; `domMax` would re-add the weight this spec removes.
- [x] Q: sync vs async features load? — Owner: Clarence — A: sync, to avoid a first-paint flash on the above-the-fold Hero.
