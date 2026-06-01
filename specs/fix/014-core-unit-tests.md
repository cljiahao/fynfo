---
id: 014
slug: core-unit-tests
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence approved Phase 2 of the 2026-06-02 audit roadmap (track selection)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # adds the missing regression/characterization tests for the security core
  - '§2.1' # locks the AES-256-GCM encrypt/decrypt + DEK-derivation contract under test
  - '§2.3' # asserts requireUserId/getVaultDekSession ordering in the action guard
constitution_overrides:
---

# Spec 014: Unit tests for the security core (crypto, keystore, guards, error mapper)

## Problem

The audit (`docs/audit/2026-06-02-project-audit-roadmap.md`, HIGH #5) found the modules that own
confidentiality, key derivation, auth+vault enforcement, and DB-leak prevention have **no direct
tests**: `src/lib/crypto.ts`, `src/lib/keystore.ts`, `src/lib/action-guard.ts`,
`src/lib/errors/handle-api-error.ts`. They are exercised only indirectly via `test/api/vault.test.ts`.
A regression in any of them (wrong key length, broken auth-tag handling, dropped auth check, an error
mapper that leaks DB text) would ship silently. All four are pure/mockable and testable in the
existing node-env vitest setup with **no new dependency**.

## Constitution check

- Satisfies:
  - `§4.2` — adds the missing characterization tests; each asserts the current correct behaviour so
    future regressions fail CI.
  - `§2.1` — pins the AES-256-GCM envelope (round-trip, wrong-key, tamper, malformed input all raise
    `DecryptionError`) and the PBKDF2-600k derivation (deterministic vector, salt sensitivity, key
    length).
  - `§2.3` — asserts `requireActionContext` enforces `getUser()` (auth) and a present DEK (vault)
    before returning a context, and throws otherwise.
- Overrides: none. No HARD rule touched. No new dependency. No production code change — test-only,
  plus the spec file. No migration.

## Solution shape

New test files only, under `test/lib/**`, following the mocking pattern already proven in
`test/api/vault.test.ts` (`vi.mock('next/headers')`, `vi.mock('@/integrations/services/supabase')`,
`process.env` seeding):

- `test/lib/crypto.test.ts`
  - round-trip: `decryptPayload(encryptPayload(x)) === x` for empty / unicode / long strings.
  - wrong key → `DecryptionError`.
  - tampered ciphertext / auth tag → `DecryptionError`.
  - malformed base64 / non-JSON input → `DecryptionError` (not a raw throw).
- `test/lib/keystore.test.ts`
  - `deriveKeyFromPinV2`: deterministic for same (pin, userId); differs when salt (userId) differs;
    returns a 32-byte buffer.
  - `getVaultDekSession`: returns `null` with no cookie; returns the original DEK for a validly
    sealed cookie (seal replicated in-test from the documented `SHA256(SESSION_SECRET)` GCM
    envelope); returns `null` for a tampered cookie blob.
- `test/lib/action-guard.test.ts`
  - `requireActionContext`: unauthenticated (`getUser` error/no user) throws `Unauthorized`; locked
    vault (`getVaultDekSession` → null) throws `Vault is locked`; happy path returns
    `{ userId, dek, supabase }`.
  - `requireDbContext`: unauthenticated throws; happy path returns `{ userId, supabase }`.
- `test/lib/handle-api-error.test.ts`
  - `ZodError` → 400 with flattened issues; `DecryptionError` → 401 `Incorrect PIN`; `AppError` →
    its `status`/`code`/`message`; unknown `Error('supabase: relation \"x\" does not exist')` → 500
    with body exactly `{ error: 'Internal Server Error' }` (asserts the internal message does NOT
    appear in the response — leak guard).

## Out of scope

- Server-action tests (`features/*/actions`) — next spec (`015-action-tests`).
- Coverage thresholds in `vitest.config.ts` — `016-coverage-thresholds`, once a baseline exists.
- Any production code change (the audit's crypto-hardening / cookie-dedup items are separate specs).
- Component/hook render tests (blocked on the jsdom/RTL dep decision — deferred).

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck, max-warnings=0)
- [ ] `pnpm test:ci` green; the four new test files pass and exercise the cases above.
- [ ] `pnpm build` green
- [ ] No production source file changed (test files + this spec only).
- [ ] No `any`, no `console.log`, no new dependency.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: none on runtime — test-only. Worst case a flaky/incorrect test; caught by the
  gate before merge.
- **Reversibility**: `git revert` the impl commit.
- **Backout plan**: delete the four test files.

## Open questions

- None. (Coverage-threshold values deferred to `016` once these tests establish a baseline.)
