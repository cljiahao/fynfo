---
id: 003
slug: dashboard-dark-mode
area: feature
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner approved design (light/dark/system in user menu, token audit) in brainstorming
shipped: 2026-06-03
impl_pr: direct-to-main (solo project; spec-first + green gates)
supersedes:
constitution_satisfies:
  - '§4.1' # presentation only; tokens + toggle in existing layout components
constitution_overrides:
---

# Spec feature/003: Dashboard light/dark mode

## Problem

`next-themes` is already wired in `src/app/layout.tsx` (`attribute="class"`,
`defaultTheme="light"`) and Tailwind `.dark` tokens exist, but there is **no
toggle in the UI** — only `sonner.tsx` reads the theme. Worse, several dashboard
surfaces hardcode light colors (`bg-white` in the authed `navbar.tsx`,
`bg-black`/`text-white` in `site-footer.tsx`, `text-black`/`bg-white` in
`accordion.tsx` and `split-dialog.tsx`), so even forcing the theme would render
inconsistently. Users cannot choose a theme, and the dashboard can never be a
clean dark surface.

## Constitution check

- Satisfies: `§4.1` (presentation only; toggle lives in the existing user-menu
  component, color audit in existing layout/ui components). Overrides: none.
- No `HARD` rule touched. No backend, data, auth, or encryption change.
- No new dependency (`next-themes` already present).

## Solution shape

Add a **Light / Dark / System** toggle in the user-menu dropdown; audit
dashboard surfaces to use semantic Tailwind tokens so they follow the theme. The
**landing page stays dark-always** (its own `.dark` wrapper from feature/002) and
is untouched.

- **`src/components/layout/theme-toggle.tsx`** (new, `'use client'`) — uses
  `next-themes` `useTheme`; renders three `DropdownMenuItem`s (Sun=light,
  Moon=dark, Monitor=system) calling `setTheme('light'|'dark'|'system')`. A
  `mounted` guard (set in `useEffect`) prevents the hydration mismatch
  next-themes warns about. Designed to be dropped inside the existing
  `DropdownMenuContent`.
- **`src/components/layout/user-menu-dropdown.tsx`** — insert `<ThemeToggle />`
  (with a `DropdownMenuSeparator`) above the Log out item.
- **Token audit** (replace hardcoded light/dark colors with semantic tokens
  `bg-background` / `text-foreground` / `border-border` / `bg-card` etc.):
  - `src/components/layout/navbar.tsx` — authed (`isDashboard`) branch only;
    public branch stays dark glass (feature/002, untouched).
  - `src/components/layout/site-footer.tsx` — add `tone?: 'app' | 'marketing'`
    prop (default `'app'`). `'app'` uses tokens; `'marketing'` keeps the current
    dark zinc. `src/app/(public)/layout.tsx` passes `tone="marketing"` to protect
    the dark-always landing; `src/app/dashboard/layout.tsx` uses the default.
  - `src/components/ui/accordion.tsx`, `src/components/ui/split-dialog.tsx`, and
    any remaining `bg-white` / `bg-black` / `text-black` in the dashboard tree →
    tokens.
- Confirm the `.dark` token vars already exist in the global stylesheet; add only
  if a referenced token is missing (no palette redesign).

## Out of scope

- The marketing/landing page and its dark-always treatment (feature/002).
- The login / `(public)` pages beyond passing `tone="marketing"` to the footer.
- Any restyling beyond swapping hardcoded colors for existing tokens (no new
  palette, spacing, or layout changes).
- Persisting theme server-side (next-themes localStorage is sufficient).

## Out-of-scope drift note

If the audit surfaces hardcoded colors outside the dashboard tree, list them in
the impl notes per AGENTS.md §7 rather than fixing opportunistically.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; new tests cover: `ThemeToggle` renders the three
      options and calls `setTheme` with `'light'|'dark'|'system'`; `SiteFooter`
      with `tone="marketing"` keeps its dark classes and with `tone="app"` uses
      tokens.
- [ ] `pnpm build` green
- [ ] Manual: toggle Light/Dark/System from the user menu → dashboard navbar,
      footer, accordions, and dialogs all follow the theme with no hardcoded
      white/black islands; System follows OS; landing page remains dark
      regardless of the toggle.
- [ ] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius**: authenticated dashboard presentation + the shared footer.
  Worst case = a missed hardcoded color (cosmetic), never data/auth impact.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit; dashboard returns to light-only with no
  toggle.

## Open questions

- None. (Light/Dark/System in user menu, landing dark-always — confirmed with
  owner.)
