---
id: 001
slug: decrypt-field-helpers
area: refactor
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved roadmap Phase 3 (DRY)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§3.1' # DRY — single source for the per-field decrypt idioms
  - '§4.2' # ships unit tests for the new helpers
constitution_overrides:
---

# Spec refactor/001: Shared decrypt-field helpers (DRY across 5 action files)

## Problem

Every `get*` server action hand-rolls the same per-field decrypt idioms across five files
(`expenses`, `salary`, `relief`, `equity`, `assets`):

- `Number(await decryptPayload(x, dek))` — repeated ~10×.
- `x ? await decryptPayload(x, dek) : ''` — repeated ~4× (optional string).
- `x ? Number(await decryptPayload(x, dek)) : 0` — equity fees (optional number).

The loop shape (`Promise.all(rows.map(...))`) differs per feature and is fine, but the **field-level**
guards are duplicated and individually error-prone — a forgotten `? : ''` or a missing `Number(...)`
is a silent data bug on an encryption boundary. There is no single place to test or fix them.

## Constitution check

- Satisfies `§3.1` (DRY) and `§4.2` (tests). Overrides: none. No migration, no new dependency.
- **Encryption-touching**: yes — these wrap `decryptPayload`. Behavior is preserved exactly
  (helpers are literal extractions of the current inline expressions).

## Solution shape

- New `src/lib/crypto-fields.ts` (thin wrappers over `decryptPayload`, `dek: Buffer`):
  - `decryptNumber(cipher, dek)` → `Number(await decryptPayload(cipher, dek))`.
  - `decryptOptionalString(cipher: string | null | undefined, dek)` → `''` when falsy.
  - `decryptOptionalNumber(cipher: string | null | undefined, dek, fallback = 0)` → `fallback` when
    falsy.
- Swap the inline idioms in the five `actions/*.ts` files to call the helpers. Required-string fields
  (e.g. equity `ticker`) keep calling `decryptPayload` directly — a pure alias would be needless.
- No change to the encrypt side, the loop structure, query shapes, or return types.

## Out of scope

- Encrypt-side helpers (`encryptPayload(n.toString())` etc.) — a separate future DRY pass.
- Abstracting the `Promise.all(rows.map(...))` loop (feature-specific; not duplication worth hiding).
- Adding tests for the assets/equity/relief actions (no fake-supabase coverage yet; tracked
  separately). Expenses + salary action tests already exercise the decrypt path through the helpers.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New `test/lib/crypto-fields.test.ts`: round-trips a number; optional-string returns `''` for
      `null`/`undefined`/`''` and the value otherwise; optional-number returns the fallback for falsy
      and the parsed number otherwise.
- [ ] Existing expense + salary action tests still green (decrypt path now routed through helpers).
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: all read actions across five features. Mitigated by literal-extraction (no logic
  change), helper unit tests, and the existing expense/salary action tests.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
