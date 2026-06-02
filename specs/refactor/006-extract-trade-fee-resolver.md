---
id: 006
slug: extract-trade-fee-resolver
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved roadmap Phase 3 (SRP/DRY)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # DRY/SRP — single gated fee resolver out of the form
  - '§4.2' # ships unit tests for the resolver
constitution_overrides:
---

# Spec refactor/006: Extract the trade-form fee resolver (DRY)

## Problem

`trade-form.tsx` (411 lines, audit Phase 3) computed fees twice — the live `calculatedFees` preview and
the `autoFillFees` writer — each re-implementing the same gating (require ticker/action/positive value;
require a valid broker unless PO) before calling `calculateFees`. Duplicated, drift-prone, untested
gating on money math.

## Constitution check

- Satisfies `§3.1` (DRY/SRP) and `§4.2` (tests). Overrides: none. No migration, no new dependency, no
  encryption path. Behavior-preserving extraction.

## Solution shape

- Add `resolveTradeFees(input) → FeeResult | null` to `src/features/equity/lib/broker-fees.ts`: gates
  the raw inputs, returns null when not yet priceable, else delegates to `calculateFees`. Export
  `FeeResult`.
- `trade-form.tsx` calls `resolveTradeFees` from both sites; the two inline IIFEs and the now-unused
  `calculateFees`/`Broker` imports are removed.

## Out of scope

- Decomposing the form JSX (no render test harness; the `isPO` reset bug + defaults seam were already
  handled in fix/019).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [x] New `resolveTradeFees` tests: prices a full trade (matches `calculateFees`), null on missing
      ticker/action/value, broker required unless PO. 245 total.
- [x] No new dependency, no `any`, no `console.log`.

## Risk & reversibility

- **Blast radius**: trade-entry fee preview/auto-fill only; literal extraction, JSX untouched.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
