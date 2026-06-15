---
id: 043
slug: broker-select-show-saved
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.1' # edit form must display the saved broker
constitution_overrides:
---

# Spec 043: Broker Select must show the saved value even if outside BROKERS

## Problem

Spec 041 fixed the broker Select binding (Controller), but the dropdown is still
blank on edit when the saved broker is not one of the two hardcoded `BROKERS`
(`'DBS Vickers'`, `'Moomoo'`). The trade schema allows any broker string
(`z.string().min(1).max(64)`), so a trade saved with a different broker has no
matching `<SelectItem>` and renders blank — the value exists in form state but
can't be displayed or preserved through a re-selection.

## Constitution check

- Satisfies `§4.1` (edit UI reflects saved state). Overrides: none. No migration,
  no new dependency. One component file.

## Solution shape

`src/features/equity/components/trade-form.tsx`:

- In the broker `<Controller>` render, build the option list as
  `BROKERS` plus the current `field.value` when it is non-empty and not already in
  `BROKERS`. Render `<SelectItem>`s from that list so the saved broker is always
  selectable/displayable. Fee calc is unchanged (still only computes for known
  brokers; an unknown broker just shows + round-trips).

## Out of scope

- Widening the canonical `BROKERS` list or adding fee formulas for more brokers
  (separate; depends on which brokers the user actually uses).
- Free-text broker entry.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: edit a trade whose broker is outside the two defaults → the saved
      broker shows selected and survives save; known brokers still work
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: broker field of the trade dialog only.
- **Reversibility**: single `git revert`.

## Open questions

- [ ] Q: none.
