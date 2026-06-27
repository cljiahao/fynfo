---
id: 057
slug: client-crypto-coverage
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-27
approved: 2026-06-27
shipped: 2026-06-27
impl_pr:
supersedes:
constitution_satisfies:
  - '§4.2' # test coverage for security-critical crypto
  - '§5.1' # locks the client DEK derivation params to the canonical PBKDF2
constitution_overrides:
---

# Spec 057: Test the client-side DEK derivation (`client-crypto.ts`)

## Problem

`src/lib/client-crypto.ts` is the **only** PIN→DEK derivation in the app: the
client derives the 256-bit DEK via WebCrypto PBKDF2 (`deriveKeyClient` for the v2
per-user-salt scheme, `deriveKeyLegacy` for the v1 static-salt migration path) and
POSTs it to `/api/vault`, which only verifies the canary (the server no longer
derives from the PIN — `keystore.ts` has no `deriveKeyFromPinV2`). It runs on
every unlock (`features/auth/components/vault-unlock-flow.tsx`) yet has **zero
tests** (10% lines / 0% functions per the coverage sweep). A silent drift in its
PBKDF2 parameters (iterations, salt, key length, hash) — which it shares with the
server field-encryption via `crypto-constants.ts` — would either lock every user
out or weaken the zero-knowledge key without any test catching it.

## Constitution check

- Satisfies `§4.2` (security-critical crypto gets tests) and `§5.1` (locks the
  derivation to canonical PBKDF2 with the shared constants).
- Overrides: none. Test-only + a vitest per-file gate. No app code, dependency,
  schema, or governance path.

## Solution shape

- **`test/lib/client-crypto.test.ts` (new)** — runs in the default node env, where
  `globalThis.crypto.subtle` (WebCrypto) is available:
  - **Known-answer / lock-step:** `deriveKeyClient(pin, userId)` equals
    `crypto.pbkdf2Sync(pin, userId, V2_ITERATIONS, KEY_LEN_BYTES, 'sha256')`
    base64 — proving the WebCrypto path matches the canonical PBKDF2 with the
    `crypto-constants.ts` params (the real regression guard).
  - `deriveKeyLegacy(pin)` equals `pbkdf2Sync(pin, 'fynfo_v1_salt', …)` — locks the
    v1 static salt.
  - Determinism: same `(pin, userId)` → same key across calls.
  - Salt sensitivity: different `userId` → different key; `deriveKeyClient` (v2)
    ≠ `deriveKeyLegacy` (v1) for the same pin.
  - Output shape: base64 decoding to exactly 32 bytes.
- **`vitest.config.ts`** — add a per-file threshold for `src/lib/client-crypto.ts`
  (lines/statements/functions 100, branches 90), mirroring the `crypto.ts` /
  `keystore.ts` gates so the security core stays locked.

No change to `client-crypto.ts` itself.

## Out of scope

- **`vault-migration.ts`** (0%, `migrateUserVault` bulk re-encrypt) — deliberately
  deferred: it is **unwired** (imported nowhere in `src/`, the deferred
  rekey-on-unlock follow-up), and its `Promise.all` parallel table reads can't be
  distinguished by the current `fake-supabase` (which binds select data at
  await-time, not call-time). Testing it well needs a fake-supabase enhancement —
  low ROI for code in no live path. Test it when the rekey feature wires it.
- The UI-render-test backlog (documented jsdom/RTL deferral).
- Any change to the derivation itself or the vault unlock flow.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] `client-crypto.ts` per-file gated; new tests cover both functions, the
      known-answer lock-step vs node `crypto.pbkdf2Sync`, determinism, salt
      sensitivity, and 32-byte output.
- [ ] `pnpm test:coverage` green with the new gate.
- [ ] Test-only + `vitest.config.ts`; no app code touched.
- [ ] No `any`, no `console.log`, no dependency.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: tests + one coverage threshold. Zero runtime impact.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
