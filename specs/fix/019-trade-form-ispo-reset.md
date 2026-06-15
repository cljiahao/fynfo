---
id: 019
slug: trade-form-ispo-reset
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # audit Phase 3; Clarence pre-approved roadmap fixes
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # DRY — one source for the form's default/reset values
  - '§4.2' # ships a unit test for the extracted seam
constitution_overrides:
---

# Spec 019 (fix): trade-form `isPO` not reset on edit/reopen

## Problem

`TradeFormDialog` builds its initial values three times — `defaultValues` and two `form.reset(...)`
calls (edit path, new-dialog path). Both `reset` objects **omit `isPO`**. React Hook Form's
`reset(values)` replaces the entire form state with exactly `values`, so the omitted `isPO` becomes
`undefined` (not `false`) after an edit or a reopen. The PO checkbox then carries stale/undefined
state into fee calculation (`calculateFees(..., isPO)`) and the `disabled={isPO}` UI gates. `isCdp` is
reset in both objects; `isPO` was simply forgotten. The three near-identical value objects also drift
independently — which is how the omission happened.

## Constitution check

- Satisfies `§3.1` (DRY) and `§4.2` (test). Overrides: none. No migration, no new dependency, no
  encryption-path change.

## Solution shape

- New non-client `src/features/equity/lib/trade-form-defaults.ts`:
  - Export the `TradeFormValues` interface (moved out of the component).
  - Export `buildTradeFormDefaults(editTrade?, todayIso?)` returning the full value object for either
    the new-trade case (empty fields, `today`) or the edit case (mapped from `editTrade`). **Always**
    sets `isCdp: false` and `isPO: false`.
- `trade-form.tsx`: import the type + helper; use `buildTradeFormDefaults()` for `defaultValues`,
  `buildTradeFormDefaults(editTrade)` in the edit reset, and `buildTradeFormDefaults()` in the
  new-dialog reset. Remove the local interface and the three inline objects.

## Out of scope

- The broader decomposition of `trade-form.tsx` (still oversized) — a later SRP pass; this spec only
  fixes the bug and extracts the values seam it needs.
- Any change to `calculateFees` / broker-fee logic.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New `test/features/equity/trade-form-defaults.test.ts`: new-trade defaults have `isPO === false`
      and `isCdp === false` and empty fields; edit defaults map every `editTrade` field and force
      `isPO === false` / `isCdp === false`.
- [ ] `isPO` is `false` (never `undefined`) after both reset paths.
- [ ] No new dependency, no `any` (the existing `'' as unknown as number` empty-input cast is
      preserved as-is), no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: the trade entry/edit dialog only. Strictly corrects PO state (undefined → false);
  fee math already treated PO as falsy, so totals are unchanged, but the checkbox/disabled state is
  now correct on reopen.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
