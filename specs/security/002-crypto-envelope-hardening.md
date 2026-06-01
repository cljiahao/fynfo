---
id: 002
slug: crypto-envelope-hardening
area: security
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence approved Phase 1 of the 2026-06-02 audit roadmap
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # hardens the AES-256-GCM envelope without changing its semantics
  - '§4.2' # ships tests for the new validation + the de-duplicated seal module
constitution_overrides:
---

# Spec 002 (security): Crypto-envelope hardening — timing-safe canary, decrypt validation, single cookie seal

## Problem

From the audit (`docs/audit/2026-06-02-project-audit-roadmap.md`, MED + HIGH#2 tail):

1. **Cookie seal duplicated and divergent.** The session-cookie AES-256-GCM envelope is implemented
   twice: `encryptCookiePayload`/`cookieBlob` in `src/app/api/vault/route.ts` and
   `decryptCookiePayload` in `src/lib/keystore.ts`. Any drift between them silently bricks every
   vault. Single source of truth needed.
2. **Canary compare not timing-safe.** `verifyCanary` in `route.ts` uses `decrypted !== VAULT_CANARY`
   (`route.ts:68`). Use `crypto.timingSafeEqual` (defense-in-depth; GCM already authenticates).
3. **`decryptPayload` trusts `JSON.parse` shape.** `src/lib/crypto.ts` passes `iv`/`tag` straight to
   `createDecipheriv`/`setAuthTag` with no length check; malformed input is only caught by the
   blanket `catch`. Validate `iv` is 12 bytes and `tag` is 16 bytes explicitly.

## Constitution check

- Satisfies `§2.1` — the AES-256-GCM semantics and the on-disk/cookie byte format are unchanged; this
  only removes duplication and adds input validation + a constant-time compare. No plaintext reaches
  any new surface. Satisfies `§4.2` — new tests cover the seal round-trip/tamper and the decrypt
  validation.
- Overrides: none. No HARD rule. No new dependency. No migration. Not a governance-protected path
  (`api/vault` and `lib/` are normal code).

## Solution shape

- **New `src/lib/cookie-seal.ts`** — single source of truth for the cookie envelope:
  - `getSessionSecret()` (moved here from `keystore.ts`; re-exported from `keystore.ts` for
    backward-compatible imports).
  - `sealCookie(plaintext): string` — `base64(JSON{iv,data,tag})`, AES-256-GCM under
    `SHA256(SESSION_SECRET)`. Byte-identical to today's `cookieBlob(encryptCookiePayload(...))`.
  - `openCookie(blob): string` — inverse; validates `iv`=12 / `tag`=16 bytes, throws on
    tamper/malformed.
- **`src/app/api/vault/route.ts`** — delete `encryptCookiePayload`/`cookieBlob`/the `getSessionSecret`
  import; set the cookie via `sealCookie(dek.toString('base64'))`. Make `verifyCanary` compare with a
  length-checked `crypto.timingSafeEqual`.
- **`src/lib/keystore.ts`** — delete `getSessionSecret`/`decryptCookiePayload`; `getVaultDekSession`
  calls `openCookie`; re-export `getSessionSecret` from `cookie-seal`.
- **`src/lib/crypto.ts`** — in `decryptPayload`, validate decoded `iv`(12)/`tag`(16) length before
  `createDecipheriv`; on violation throw `DecryptionError`.
- **Tests**: `test/lib/cookie-seal.test.ts` (round-trip; tampered tag/data → throw; wrong secret →
  throw); extend `test/lib/crypto.test.ts` with a wrong-IV-length → `DecryptionError` case. Existing
  `keystore.test.ts` + `vault.test.ts` continue to pass unchanged (format preserved), proving the
  refactor is behaviour-preserving.

## Out of scope

- **Vault PIN-unlock rate-limiting / lockout** — separate spec (`security/003`), needs a migration +
  a policy decision.
- HKDF for the cookie key, `sameSite:'strict'`, TOFU first-unlock hardening, log-redaction allowlist
  — separate Phase-1 specs.
- Any change to the PBKDF2 derivation or the field-encryption format.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New + existing crypto/keystore/vault tests pass (format-preserving refactor proven).
- [ ] Files touched: `cookie-seal.ts` (new), `vault/route.ts`, `keystore.ts`, `crypto.ts`, two test
      files. No migration, no dep, no governance path.
- [ ] No `any`, no `console.log`.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: the vault unlock + every encrypted read/write. Mitigated: the cookie/field byte
  format is unchanged (a returning user's existing cookie still opens), and the unlock path is
  covered by `vault.test.ts` + `keystore.test.ts`.
- **Reversibility**: single `git revert`. No data migration — existing cookies/canaries stay valid.
- **Backout plan**: revert the commit; behaviour returns to the duplicated-seal version.

## Open questions

- None.
