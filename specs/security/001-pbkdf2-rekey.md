---
id: 001
slug: pbkdf2-rekey-on-unlock
area: governance
status: approved
author: claude (templatecentral v4 alignment, 2026-05-27)
created: 2026-05-27
approved: 2026-05-27
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§Security' # zero-knowledge encryption invariant
  - '§Privacy' # PIN-derived DEK must resist offline brute-force
constitution_overrides:
---

# Spec 001: PBKDF2 hardening with rekey-on-unlock

## Problem

The vault DEK is derived from a 6-digit PIN with PBKDF2 v1: **100 000 iterations + fixed string salt `'fynfo_v1_salt'`**. Both parameters fall short of OWASP 2025 / FIPS-140 minimums:

- OWASP Password Storage Cheat Sheet (2025): PBKDF2-HMAC-SHA-256 ≥ **310 000 iterations**.
- FIPS-140 internal hash recommendation: **600 000 iterations** with HMAC-SHA-256.
- Salt must be **unique per user**; a fixed string defeats the rainbow-table resistance salt is supposed to provide.

A leak of `users_profile.vault_check` ciphertexts plus knowledge of the v1 PBKDF2 params would let an attacker exhaustively try all 1 000 000 six-digit PINs in well under a day on consumer GPUs. With a per-user salt + 600k iterations, the same attack is single-PIN at a time and ~6× slower per attempt.

`src/lib/keystore.ts` already exports `deriveKeyFromPinV2(pin, userId)` with the hardened params and `src/lib/crypto-constants.ts` shares them with `src/lib/client-crypto.ts`. This spec covers the migration path so existing vaults (one per active user — Clarence + fiancée) keep working through the change.

## Constitution check

- Satisfies: `§Security`, `§Privacy`.
- Overrides: none.

## Solution shape

### Schema delta (`supabase/migrations/<NEW>__add_vault_v2.sql`)

- `users_profile`:
  - `vault_check_v2: text` — encrypted canary under v2 DEK; nullable.
  - `vault_version: smallint NOT NULL DEFAULT 1`.

### Client (`src/lib/client-crypto.ts`)

- `deriveKeyClientV2(pin, userId): Promise<string>` — Web Crypto PBKDF2 with V2_ITERATIONS + per-user salt.
- New `getVaultVersion(userId)` server action returns the user's current version so the client picks the right derivation.

### Server (`src/app/api/vault/route.ts`)

- Add `GET` returning `{ version: 1 | 2 }` for the current user. (Or extend `POST` body to include version negotiation in one round trip.)
- `POST` flow:
  1. Receive `{ derivedKey, derivedKeyV2? }` from client (client computes both during transition).
  2. Verify v2 canary with `derivedKeyV2` if `vault_check_v2` populated → success, set cookie with V2 DEK.
  3. Else (legacy user with only `vault_check`): verify v1 canary with `derivedKey` → **rekey**:
     - Walk every encrypted column for this user (see below), decrypt with V1 DEK, re-encrypt with V2 DEK.
     - Write `vault_check_v2`, bump `vault_version = 2`, null out `vault_check`.
     - Set cookie with V2 DEK.
  4. First-unlock user (neither canary): use V2 path only.

### Re-encryption sweep (server-side, inside the `POST` transaction)

Tables + columns containing user-owned ciphertext (verified from `supabase/migrations/`):

| Table                                 | Encrypted columns                        |
| ------------------------------------- | ---------------------------------------- |
| `users_profile`                       | `vault_check` (becomes `vault_check_v2`) |
| `equity_trades`                       | `ticker`, `shares`, `price`, `fees`      |
| `expense_records`                     | `item`, `info`, `amount`                 |
| `expense_splits`                      | `amount`                                 |
| `salary_records`                      | `salary`, `bonus`                        |
| `monthly_snapshots` → `asset_entries` | `account`, `amount`                      |
| `tax_relief_entries`                  | `amount`                                 |

Wrap the sweep in a single Supabase transaction. If any decrypt fails (corrupt row), abort the unlock and surface a `VAULT_REKEY_FAILED` error — caller is `Clarence` or `fiancée` so manual remediation is fine.

### Removal of v1 surface (post-cutover)

- Once both active users have `vault_version = 2`, schedule a follow-up spec to delete `deriveKeyFromPin`, `deriveKeyClient`, and the V1 constants in `crypto-constants.ts`. Keep the V2 names un-suffixed at that point.

## Out of scope

- Argon2id migration (separate spec; OWASP's top recommendation but requires a different transport contract).
- Multi-device session synchronization.
- Removing the cookie-stored DEK pattern.
- Changing the canary string `'fynfo_vault_ok'`.

## Acceptance

- [ ] Supabase migration adds `vault_check_v2` + `vault_version` with RLS unchanged.
- [ ] `pnpm check` green.
- [ ] `pnpm test:ci` green; new tests cover: (a) v1 unlock → rekey path, (b) v2 unlock direct path, (c) first-unlock direct V2 path, (d) wrong PIN → 401 with no partial state.
- [ ] `pnpm build` green.
- [ ] Manual: legacy local DB row with `vault_version = 1` unlocks via PIN; after unlock, `vault_version` == 2, `vault_check_v2` populated, `vault_check` cleared; subsequent unlocks skip rekey path.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: 100% of vault data. Bug here = user locked out of own data.
- **Reversibility**: data-side is reversible by re-running the sweep with v1 derivation (kept until post-cutover spec). Schema side is single `ALTER TABLE` revert.
- **Backout plan**:
  1. Roll back the impl PR.
  2. Verify `vault_check_v2` is unset (or accept dual-stack reads via v1 fallback).
  3. Keep v2 columns but stop reading them; document state in a fix spec.

## Open questions

- [ ] Q: Two clients (Clarence, fiancée) — coordinated rekey window or roll-by-user? Owner: Clarence — A: roll-by-user (each unlocks at their own pace; v1 surface stays alive until both at v2).
- [ ] Q: Should the GET endpoint exposing `vault_version` be rate-limited the same as POST? Owner: Clarence — A: yes, share the (still-TODO) `/api/vault` rate limiter; tracked under a separate ratelimit spec.
- [ ] Q: Argon2id sooner or later? Owner: Clarence — A: later, separate spec; PBKDF2-600k is FIPS-140 compliant and sufficient for the threat model (offline brute-force of a 6-digit PIN protected by 600k iters).
