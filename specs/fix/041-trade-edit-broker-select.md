---
id: 041
slug: trade-edit-broker-select
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
  - '§4.1' # UI correctness — edit form reflects saved values
constitution_overrides:
---

# Spec 041: Broker not shown when editing a trade

## Problem

Opening the Edit dialog on an existing trade leaves the Broker dropdown blank,
even though the broker was saved and is a valid `BROKERS` value (confirmed: the
fee calc, which returns null for unknown brokers, is correct). The register-based
fields (ticker, shares, price, date) populate correctly on edit because
`form.reset()` writes their DOM values directly. The broker `<Select>`
(`trade-form.tsx:227`) is instead bound to `value={broker}` from a whole-form
`useWatch({ control })` with no `register`/`Controller`. On the first render that
watch is `undefined`, so the Radix Select latches _uncontrolled_; when `broker`
later resolves to the saved value the Select ignores the change → blank. Data is
intact (form state + submit are correct); only the display is wrong, which is
misleading on edit.

## Constitution check

- Satisfies `§4.1` (edit UI reflects saved state). Overrides: none. No migration,
  no new dependency. One component file.

## Solution shape

`src/features/equity/components/trade-form.tsx` only:

- Bind the Broker `<Select>` via react-hook-form `<Controller name="broker">`
  (already a dependency; `Controller` is the canonical way to wire controlled
  inputs to RHF and re-render on `reset`). Use `value={field.value || ''}` so it is
  never `undefined`, keep `onValueChange={handleBrokerChange}` (which sets the field
  - the CDP/fees side-effects). The fee-calc read of `broker` via `useWatch` is
    unchanged (same form field, stays consistent).

## Out of scope

- The dividend-form currency Select (same pattern but defaults to `'SGD'`, no repro)
  — leave unless it surfaces.
- Widening `BROKERS` / free-text broker — separate concern.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: edit a DBS Vickers trade and a Moomoo trade → the saved broker shows
      selected; changing it still works; CDP auto-tick + fee autofill unaffected
- [ ] Manual: new-trade flow still starts with an empty broker placeholder
- [ ] Spec hash unchanged at impl time

## Risk & reversibility

- **Blast radius**: the broker field of the trade dialog only.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- [ ] Q: none.
