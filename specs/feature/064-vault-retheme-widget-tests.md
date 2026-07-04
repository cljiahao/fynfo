---
id: 064
slug: vault-retheme-widget-tests
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

# Spec 064: Vault-unlock retheme + widget render tests

## Problem

Two loose ends after the 063 re-sweep:

- `auth/vault-unlock-flow.tsx` is the last authed surface off the token system —
  a bespoke forced-dark palette (`zinc-950`/`zinc-800`, `blue-500/600`,
  `text-white`, a raw `rgba` glow) that does not adapt to light theme and shares
  nothing with the brand tokens. It's the vault PIN overlay — the first thing a
  user sees each session.
- The two new shared widgets (`StatCard`, `PageHeader`) shipped in 062 with no
  dedicated render tests (the "only lever left = UI render tests" gap).

(Radius drift flagged by the re-audit was re-checked and is actually coherent —
card-level `rounded-xl`, nested sub-panels `rounded-lg` — so it is left as-is.)

## Constitution check

- Satisfies: `§1.1` (usability, trust, consistent identity).
- Overrides: none. No crypto/auth _logic_ touched — presentation only.

## Solution shape

### Vault retheme (`auth/vault-unlock-flow.tsx`) — classes only, no logic

- Card `border-zinc-800 bg-zinc-950` → `border-border bg-card`.
- Icon chip `bg-blue-500/10 text-blue-500 shadow-[rgba…]` → `bg-brand-subtle
text-brand` (drop the raw glow).
- Progress track `bg-zinc-800` → `bg-muted`; fill `bg-blue-500` → `bg-brand`.
- Heading `text-white` → default foreground; copy `text-zinc-400` →
  `text-muted-foreground`.
- PIN input `border-zinc-800 bg-zinc-900 text-white focus-visible:ring-blue-500`
  → `border-input bg-background` (global `--ring`=brand handles focus).
- Unlock button raw `bg-blue-600 text-white hover:bg-blue-500` → `bg-brand
text-brand-foreground hover:bg-brand/90`.
- Scrim `bg-black/60 backdrop-blur-md` retained (modal scrim, theme-neutral).

### Widget tests (jsdom + RTL, per house pattern)

- `test/components/stat-card.test.tsx` — renders label/value/hint; `trend`
  renders the up/down arrow; `tone` applies gain/loss class; `children` render.
- `test/components/page-header.test.tsx` — renders title (as `<h1>`); optional
  description + action slot.

## Out of scope

- Vault derivation / auth / crypto logic — untouched.
- Radius (already consistent).
- Harness update (separate governance draft, human-applied).

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green (2 new test files)
- [ ] `pnpm build` green
- [ ] Grep: no `zinc-`/`blue-[0-9]` left in `vault-unlock-flow.tsx`
- [ ] Manual (light + dark): vault overlay adapts to both themes, brand accent

## Risk & reversibility

- **Blast radius**: the vault overlay's appearance + two new test files. No logic.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- none.
