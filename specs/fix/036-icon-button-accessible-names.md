---
id: 036
slug: icon-button-accessible-names
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-15
approved: 2026-06-15
shipped: 2026-06-15
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.1' # accessibility / UI quality
constitution_overrides:
---

# Spec 036: Accessible names on icon-only buttons (a11y)

## Problem

Icon-only buttons across the app render a single Lucide glyph with no text, so screen readers
announce them as an unlabeled "button". Verified offender: `dashboard-navbar.tsx:80` mobile-menu
`<Button size="icon">` wraps only `<Menu/>`. Same class of gap exists in the other `size="icon"`
buttons that lack an adjacent text node (`public-navbar`, `pagination-controls`,
`editable-expense-row`, `owed-summary`, `split-dialog`). The 2026-06-02 audit pre-noted this under
"a11y quick wins". Low effort, real accessibility win.

## Constitution check

- Satisfies `§4.1` (UI quality / accessibility). Overrides: none. No migration, no new dependency.
  Markup-only edits.

## Solution shape

Per icon-only button with no visible text label, add an accessible name — `aria-label` on the
button (or a `<span className="sr-only">` child for buttons that may also need visible-text
fallback). Audit each `size="icon"` usage; skip any that already have an adjacent text label or an
`aria-label`.

- `src/components/layout/dashboard-navbar.tsx` — mobile menu trigger, avatar/account dropdown
  trigger.
- `src/components/layout/public-navbar.tsx` — any icon-only trigger.
- `src/components/widgets/pagination-controls.tsx` — prev/next icon buttons + page-number input
  label.
- `src/features/expenses/components/editable-expense-row.tsx`,
  `owed-summary.tsx`, `split-dialog.tsx` — row action / dialog icon buttons.

Exclude `src/components/ui/**` shadcn primitives unless an instance is demonstrably unlabeled at
the call site (prefer labeling at the call site, not editing managed primitives).

## Out of scope

- Test coverage — spec 035.
- Broader a11y (focus order, color contrast, ARIA landmarks) — not this pass.
- Editing shadcn `ui/` primitives wholesale.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Every icon-only button audited has an `aria-label` or `sr-only` text node
- [ ] Manual: tab to each labeled control; the accessible name is non-empty (devtools a11y tree)
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: presentational markup only; no logic, no data.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- [ ] Q: none.
