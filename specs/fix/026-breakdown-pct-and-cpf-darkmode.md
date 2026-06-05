---
id: 026
slug: breakdown-pct-and-cpf-darkmode
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
created: 2026-06-05
approved: 2026-06-05 # YYYY-MM-DD, set on approval
shipped: 2026-06-05 # YYYY-MM-DD, set on impl merge
impl_pr: direct-to-main (solo project) # link to impl PR, set on shipped
supersedes: # spec id, if applicable
constitution_satisfies:
  - '§4.1'
  - '§3.1'
constitution_overrides: # SOFT only; HARD requires governance/ spec first
  - section: none
---

# Spec 026: Latest Month Breakdown — inline % + CPF dark-mode legibility

## Problem

Two issues on the assets-page "Latest Month Breakdown" card
(`src/features/assets/components/category-breakdown.tsx`):

1. **CPF breakdown unreadable in dark mode.** The CPF recharts BarChart's YAxis
   tick labels (OA/SA/MA/SRS) and the per-bar `LabelList` value text use
   recharts' default near-black fill. On the dark-mode card background this is
   black-on-black — the account names and dollar values are invisible. The
   colored bars render fine; only the text is lost.
2. **No percentage context on category bars.** The top category rows show a
   dollar amount and a progress bar but never state each category's share of
   total assets. The user must eyeball the bar width to guess the split.

## Constitution check

- Satisfies: `§4.1` (gates stay green), `§3.1` (pinned stack — no new deps;
  recharts + Tailwind only).
- Overrides: none. No `HARD` rule touched. Component is already `'use client'`
  (recharts requires it); §2.5 unaffected — no change to that decision.

## Solution shape

Single file: `src/features/assets/components/category-breakdown.tsx`.

- **Inline % (category bars only):** `pct` is already computed per category
  (current line 77). Render it beside the existing dollar amount as
  `{formatSGDWhole(amount)} · {Math.round(pct)}%`. The `%` segment uses muted
  foreground + `tabular-nums` so dollars stay primary and percentages align.
  No change to the bar geometry or the `width: pct%` style.
- **CPF dark-mode text fix:** make the chart text theme-aware via the Tailwind
  `--foreground` token rather than recharts defaults:
  - `YAxis` → `tick={{ fill: 'currentColor' }}` with `className="fill-foreground"`
    (or `text-foreground`) so ticks inherit the theme color.
  - `LabelList` → `fill="currentColor"` (or `className="fill-foreground"`).
  - The existing `Tooltip` (recharts default white surface) is left unchanged —
    out of scope; it is already legible.
- No data-model, migration, encryption, or dependency change. No public API
  change — component props (`{ snapshot }`) unchanged.

## Out of scope

- CPF breakdown chart does NOT get inline % (user chose category bars only).
- No % added to the CPF tooltip.
- `asset-bar-chart.tsx` shares the same recharts dark-mode text pattern but is
  NOT touched here — separate card, not reported, avoid scope creep.
- No restyle of the recharts Tooltip surface.

## Acceptance

- [ ] `pnpm check` green (format + lint max-warnings=0 + typecheck)
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: dark mode — CPF account names (OA/SA/MA/SRS) and dollar labels are
      legible against the card background.
- [ ] Manual: light mode — same CPF text still legible (no regression).
- [ ] Manual: each category row shows `$amount · NN%`; percentages sum to ~100%.
- [ ] Spec hash matches at impl time.

## Risk & reversibility

- **Blast radius:** one presentational component on the assets dashboard. No
  data, auth, or encryption path. Worst case is a cosmetic glitch on one card.
- **Reversibility:** single `git revert` of the impl commit. No migration, no
  state.
- **Backout plan:** revert the commit touching `category-breakdown.tsx`.

## Open questions

- None. Display style (inline always-visible) and scope (category bars only)
  confirmed with owner before approval.
