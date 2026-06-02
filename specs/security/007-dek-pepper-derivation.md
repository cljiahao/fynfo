---
id: 007
slug: dek-pepper-derivation
area: security
status: superseded # draft | approved | shipped | superseded  --  DECLINED 2026-06-02 (risk-accepted)
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: # never approved — declined by owner (risk-accepted); see decision banner
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.1' # defends the vault against offline brute-force from a DB dump
constitution_overrides:
---

# Spec 007 (security): Server pepper in the DEK derivation (DESIGN — DECLINED)

> **DECISION 2026-06-02 — DECLINED (risk-accepted by Clarence). Not implementing.**
> Fynfo is a personal, manual-entry expenses app. The threat this spec defends — an attacker holding a
> full offline Supabase DB dump brute-forcing a 6-digit PIN — is **out of scope**, and the cost (a new
> **irrecoverable** `VAULT_PEPPER` + a full rekey, with permanent-data-loss risk) is not justified for
> that data sensitivity. The realistic threat (account takeover) is already covered: **login is Google
> OAuth, so it inherits the user's Google 2FA**; data-at-rest is AES-256-GCM under a client-derived
> DEK; online PIN guessing is rate-limited (spec 003) with a timing-safe compare (spec 002). HIGH #2 is
> closed as risk-accepted. Spec retained as the analysis record; reopen only if the threat model
> changes (e.g. multi-user, or storing materially more sensitive data).
>
> _Original design preserved below for the record._

---

> **(Original draft.)** This spec proposes a change with two heavy consequences: a new **irrecoverable**
> server secret, and a **full re-encrypt (rekey) of all vault data**. It is the real fix for audit
> HIGH #2, but the stakes demand explicit sign-off and the decisions in §Open questions resolved first.

## Problem

Audit HIGH #2 (work-factor). The DEK is derived entirely client-side: `DEK = PBKDF2(pin, userId,
600k)`. The server only ever sees the derived DEK. Compensating controls already shipped — server
rate-limit + lockout (spec 003) and timing-safe canary compare (spec 002) — but **those only defend
the online path.**

Against an attacker holding a **Supabase DB dump** (breach, leaked service credentials, backup theft),
the threat is offline and unbounded by rate-limits:

- The PIN is 6 digits → ~10^6 combinations.
- PBKDF2 iteration count does **not** save a 6-digit secret offline: 10^6 guesses × even 600k iters is
  tractable on commodity GPUs.
- Every encrypted row is a brute-force oracle (guess PIN → derive DEK → a row's AES-GCM tag validates
  ⇒ correct). So peppering only the _canary_ is useless — the data rows themselves are the oracle.

Net: to a dump-holder, the vault is only as strong as a 6-digit PIN — i.e. weak.

## Proposed design

Mix a **server-held pepper** into the DEK so the effective key cannot be derived from the PIN alone:

```
clientKey = PBKDF2(pin, userId, 600k)        # unchanged, client-side
DEK_v3    = HKDF-SHA256(ikm = clientKey, salt = userId, info = "fynfo-dek-v3", key = VAULT_PEPPER)
```

- The combine happens **server-side** in `/api/vault` (the client already sends `clientKey`; it never
  sees `VAULT_PEPPER`). The HttpOnly DEK cookie holds `DEK_v3` (already sealed via `cookie-seal`).
- All `encryptPayload`/`decryptPayload` use `DEK_v3`. A dump-only attacker without `VAULT_PEPPER`
  cannot derive `DEK_v3` for **any** PIN, so the offline oracle disappears.
- Zero-knowledge at rest is preserved: the PIN never reaches the server; the server holds the pepper +
  the in-request DEK only (it already holds the DEK today to decrypt).

### Secret management (the dangerous part)

- New env `VAULT_PEPPER` — 32 random bytes, treated like a master key.
- **Irrecoverable:** lose it and every vault row is permanently undecryptable. Must be backed up with
  the same (or stricter) discipline as `SESSION_SECRET`, and documented in `.env.example` +
  recovery notes. Never rotated without a full rekey.

### Migration / rekey

- New `vault_version = 3`, canary `vault_check_v3 = encrypt(CANARY, DEK_v3)`.
- **Rekey-on-unlock**: on a successful v2 unlock where `vault_version < 3`, derive both old `DEK_v2`
  (= clientKey) and `DEK_v3`, decrypt every row with `DEK_v2`, re-encrypt with `DEK_v3`, write
  `vault_check_v3` + `vault_version = 3` in one transaction. Reuse the `rekey_user_data` machinery from
  spec 001.
- Idempotent + resumable; on any failure the vault stays v2 (old DEK still valid) and rekey retries on
  the next unlock. **No destructive drop** until v3 is confirmed for the user.

## Out of scope / alternatives to weigh first (see Open questions)

- **Longer PIN / passphrase** is the simplest entropy fix and carries **no irrecoverable-secret risk**.
  It could replace or complement the pepper. Must be decided before committing to this design.
- Pepper rotation tooling (defer; rotation = another rekey).
- `getClaims()` latency work (separate, declined).

## Acceptance (once approved)

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green; tests cover: `DEK_v3` derivation vector,
      rekey v2→v3 round-trip, unlock on a v3 vault, fail-open/rollback when rekey aborts.
- [ ] `VAULT_PEPPER` documented in `.env.example` with an explicit "irrecoverable — back this up"
      warning.
- [ ] Migration idempotent + resumable; no row dropped before v3 confirmed.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: the entire vault. A lost/incorrect `VAULT_PEPPER` ⇒ total, permanent data loss.
  This is the highest-stakes change in the project.
- **Reversibility**: code is revertible, but **once data is rekeyed to v3, the pepper is required
  forever** — reverting the code without the pepper bricks the data. Backout must keep the pepper.
- **Backout plan**: before rollout, snapshot the DB. Keep `VAULT_PEPPER` backed up in ≥2 locations.
  If aborting mid-rollout, users still on v2 are unaffected (rekey is per-user, on-unlock).

## Open questions (resolve before approval)

- [ ] Q: Is an offline **DB-dump** actually in your threat model for a personal app on managed
      Supabase? — Owner: Clarence — A: \_\_\_
- [ ] Q: Pepper vs. just increasing PIN/passphrase entropy (no irrecoverable secret) vs. both? —
      Owner: Clarence — A: \_\_\_
- [ ] Q: Where does `VAULT_PEPPER` live and how is it backed up (password manager? two locations)? —
      Owner: Clarence — A: \_\_\_
- [ ] Q: Accept the permanent-data-loss risk if the pepper is ever lost? — Owner: Clarence — A: \_\_\_
