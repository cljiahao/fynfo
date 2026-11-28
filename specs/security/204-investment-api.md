---
id: '204'
slug: investment-api
area: security
status: draft # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-28
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§5.1'
  - '§5.1a'
  - '§5.2'
  - '§5.3'
  - '§5.4'
  - '§6.3'
constitution_overrides:
---

# Spec 204: Narrow investment API (`/api/v1`) for Ballast, acciaux and Atlas

## Problem

The owner's tools need two things from fynfo: the user's current investable surplus and weekly
budget, and a place to append plan/sell-flag/verdict events that the user later reads in fynfo.
fynfo has no machine interface, and the server must keep holding only ciphertext. Without this,
the owner copies figures by hand between systems.

## Constitution check

- Satisfies: `§2.1`, `§2.2`, `§2.3`, `§2.6`, `§2.7`, `§3.1`, `§3.2`, `§5.1`, `§5.1a`, `§5.2`,
  `§5.3`, `§5.4`, `§6.3`.
- Overrides: none.
- HARD rules touched and how:
  - §2.1, §2.2, §2.3: authorized by the amendment in
    `specs/governance/203-investment-api-carve-out.md` (constitution 6.0.0). **This spec must not
    be implemented until 203 is approved and merged.**
  - §2.6/§2.7: new feature `src/features/investment-api/` has a barrel `index.ts`, named exports only.
  - §3.1: no new dependency; Node `crypto` only (X25519, HKDF-SHA256, AES-256-GCM, HMAC, `timingSafeEqual`). Zod for validation.
  - §3.2: no `any`, no secrets or real financial data in tests or docs (made-up figures only).
  - §5.1/§5.1a: journal private key wrapped under the DEK, unwrapped only in an unlocked session; no new PIN, never persisted raw.
  - §5.2: every new table ships RLS-on with its policy in the same migration; no `GRANT ALL`.
  - §5.3: caller secrets generated at runtime and shown once; nothing committed; no new secret env var required.
  - §5.4: no SQL filters or sorts on ciphertext; the journal is filtered only by caller, event type and `created_at`.
  - §6.3: migrations are additive and forward-only.

## Solution shape

### Trust model

- Summary is sealed per caller: when the user unlocks fynfo, the browser computes
  `{surplus, weekly_budget, currency, as_of}` (surplus via `derivePersonalSurplus`; expense
  override is per-browser, so computation stays client-side) and calls a server action that
  validates and seals it to each active caller's X25519 public key. The DB and API hold only
  ciphertext; the caller opens it on its own host.
- Journal is sealed to fynfo: a per-user X25519 journal keypair; the private key is wrapped under
  the DEK. Callers fetch the public key and seal events to it; only an unlocked session reads them.
- The Vercel process sees plaintext only during the user's own unlocked publish, as for every
  existing server action.
- Fields: `surplus`, `weekly_budget` (new encrypted planner setting), `currency: "SGD"`,
  `as_of`. No portfolio total, no CSPX data. Ballast uses `min(weekly_budget, surplus)` and
  refuses `as_of` older than 8 days. `as_of` is inside the sealed payload so the server cannot
  forge freshness.

### Sealed-box construction (version 1)

1. Sender generates an ephemeral X25519 keypair `(e_priv, e_pub)`.
2. `shared = X25519(e_priv, recipient_pub)`.
3. `key = HKDF-SHA256(ikm = shared, salt = e_pub || recipient_pub, info = "fynfo-sealed-v1", L = 32)`.
4. `ciphertext || tag = AES-256-GCM(key, random 12-byte nonce, plaintext, aad = "fynfo-sealed-v1" || e_pub || recipient_pub)`.
5. Envelope (JSON, then base64url): `{"v":1,"epk":<b64url 32B>,"n":<b64url 12B>,"ct":<b64url ciphertext||tag>}`.
6. Opening rejects unknown `v`. A new construction ships as `v:2` with `info` `"fynfo-sealed-v2"`;
   `v:1` stays openable. Implementation: `src/lib/sealed-box.ts`; reference vectors published in
   `docs/api/v1.md`. Python callers need `cryptography`.

### Endpoint contract

All routes under `/api/v1`, JSON, body cap 16 KB, Zod-validated, no stack/SQL/internal path in any
response. Examples use made-up figures.

| Method + path                          | Scope                         | Request                             | Response                                                                                                          |
| -------------------------------------- | ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/summary`                  | `summary:read`                | none                                | `200 {sealed, published_at}`; opens to `{surplus:1234.56, weekly_budget:300, currency:"SGD", as_of:"2026-11-27"}` |
| `GET /api/v1/journal/public-key`       | any `journal:append:*` scope  | none                                | `200 {v:1, public_key}` (journal X25519 public key, b64url)                                                       |
| `POST /api/v1/journal`                 | `journal:append:<event_type>` | `{event_type, occurred_at, sealed}` | `201 {id}`                                                                                                        |
| `GET /api/v1/journal/meta?since=<iso>` | `journal:meta`                | none                                | `200 [{id, caller, event_type, created_at}]` (no `sealed`)                                                        |

`event_type` is one of `plan`, `sell_flag`, `verdict`; the key must hold the matching
`journal:append:<type>` scope. Every auth, scope, replay or expiry failure returns the identical
`401 {"error":"unauthorized"}` (scope failure is also 401, never 403, to avoid enumeration).
Malformed body after successful auth returns `400 {"error":"invalid_request"}`; rate limit
returns `429 {"error":"rate_limited"}` with `Retry-After`.

### Request authentication

- Headers: `Authorization: Bearer fyk_<prefix>_<secret>`, `X-Kairyx-Timestamp: <unix seconds>`,
  `X-Kairyx-Signature: hex(HMAC-SHA256(secret, ts + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)))`.
  `path` includes the query string; `METHOD` upper-case; an empty body hashes the empty string.
- Key format: `secret` is 32 random bytes (b64url); `prefix` is 8 random chars for lookup. Stored:
  prefix, `SHA-256(secret)`, caller id, scopes, `expires_at` (90 days), `revoked_at`. The HMAC key is
  the secret itself: the server matches `SHA-256(presented secret)` to the stored hash with
  `timingSafeEqual`, then verifies the signature using the presented secret. The secret is never stored.
- Replay: reject timestamps outside +/-300 s; store `SHA-256(signature)` in a nonce table until
  `timestamp + 300 s` and reject duplicates.
- Rate limit: per key on the existing `rate_limit_buckets`; Vercel Firewall rule on `/api/v1/*`
  (dashboard config, applied by the owner, documented in `docs/api/v1.md`).
- Audit: caller, key id, endpoint, status, time. Never bodies, signatures or secrets.

### Callers and scopes

| Caller  | Scopes                                                            |
| ------- | ----------------------------------------------------------------- |
| atlas   | `summary:read`, `journal:meta`                                    |
| ballast | `summary:read`, `journal:append:plan`, `journal:append:sell_flag` |
| acciaux | `journal:append:verdict`                                          |

Atlas digests are not journaled (Atlas only relays).

### Key rotation

- At most two active keys per caller; creating a third is refused until one is revoked or expires.
- A new key overlaps the old until the old expires (90 days from its issue) or is revoked. The
  owner creates, shows-once, rotates and revokes from the caller management UI; revocation takes
  effect on the next request.
- A caller's X25519 public key is registered by the owner. Replacing it re-seals the summary on
  the next unlock; until then the previous summary stays sealed to the old key and is not served
  once that key is no longer registered.

### Data access

- Routes use the service-role client calling `SECURITY DEFINER` RPCs with `EXECUTE` granted to
  `service_role` only (`REVOKE ... FROM public, anon, authenticated`), following
  `src/integrations/services/security-rpc.ts`. RPCs set `search_path = ''`.
- Tables (migration `supabase/migrations/2026120*_invest_api*.sql`), all RLS-on:
  - `invest_api_callers` (id, user_id, name, x25519_public_key, created_at, revoked_at)
  - `invest_api_keys` (id, caller_id, prefix unique, secret_hash, scopes text[], expires_at, revoked_at, created_at)
  - `invest_api_nonces` (signature_hash primary key, expires_at)
  - `invest_api_audit` (id, caller_id, key_id, endpoint, status, created_at; no payload columns)
  - `invest_summaries` (user_id, caller_id, sealed, published_at; one row per caller, upsert)
  - `invest_journal_keys` (user_id primary key, public_key, wrapped_private_key, created_at)
  - `invest_journal` (id, user_id, caller_id, event_type, occurred_at, sealed, created_at)
- Owner-user `SELECT` policies exist only where the UI reads (callers, keys without
  `secret_hash`, journal, journal keys). No `UPDATE`/`DELETE` grant on `invest_journal`; a trigger
  rejects both as defense in depth (append-only). Nonce and audit rows are pruned by a
  service-role RPC, not by callers.
- RPCs: `invest_api_authenticate(prefix)`, `invest_api_consume_nonce(hash, expires_at)`,
  `invest_api_get_summary(caller_id)`, `invest_api_append_journal(...)`,
  `invest_api_journal_meta(user_id, since)`, `invest_api_audit_write(...)`.

### Encryption-touching code paths (flagged)

- `src/lib/sealed-box.ts` (seal/open, `v:1`), tested against fixed vectors.
- Publish server action: seals the summary per caller (`src/features/investment-api/actions/`).
- Journal keypair creation and DEK wrap/unwrap on first unlock (`src/features/assets` hook for the
  weekly-budget setting and publish-on-unlock; journal read via the investments page).

### Implementation plan (slices)

| #   | Slice                                                                                                             | Branch                            | Paths                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| S1  | Migration, sealed-box and HMAC libs, RPCs (service_role only)                                                     | `impl/204-investment-api-core`    | `supabase/migrations/2026120*_invest_api*.sql`, `src/lib/sealed-box.ts`, `src/lib/api-v1/**`   |
| S2  | `/api/v1/*` routes: auth, HMAC, replay, scopes, rate limit, audit, opaque errors, `docs/api/v1.md` + JSON Schemas | `impl/204-investment-api-routes`  | `src/app/api/v1/**`, `docs/api/v1.md`                                                          |
| S3  | Caller management UI: create, key shown once, register public key, rotate with overlap, revoke                    | `impl/204-investment-api-callers` | `src/features/investment-api/**`                                                               |
| S4  | Weekly budget setting, publish-on-unlock, journal keypair, investment timeline page                               | `impl/204-investment-api-journal` | `src/features/assets` (budget setting + publish hook only), `src/app/dashboard/investments/**` |

S1 first; S2-S4 then run in parallel on disjoint files.

## Threat notes

- **Stolen caller key**: scoped, hashed, revocable instantly, 90-day expiry. A leaked request log
  cannot be replayed past 5 minutes, and the nonce table blocks reuse inside the window.
- **Replay**: timestamp window plus signature-hash nonce; a duplicate returns the identical 401.
- **Journal flooding**: per-key limiter, Vercel Firewall rule on `/api/v1/*`, 16 KB body cap,
  append-only by missing grants plus trigger.
- **Server or Supabase compromise**: reads ciphertext and metadata (caller, event type, time)
  only; no opening key is ever server-held (§2.1 carve-out).
- **Enumeration and leaks**: identical 401 for every auth failure; no stack, SQL or path in
  responses (AGENTS opaque-error rule); the audit log never stores bodies.
- **Stale summary**: refreshes only on unlock; `as_of` is sealed so the server cannot forge it.
- **Malicious caller**: a stolen ballast key can append journal noise and read one summary
  sealed to its own key; it cannot read the journal, other callers' summaries or other users' data.
- **Residual**: availability (DoS) is bounded by Vercel, not eliminated; the HMAC secret equals the
  key, so key theft is full caller compromise within its scopes until revoked.

## Out of scope

- Any new dependency; any caller UI beyond fynfo's own management page; portfolio totals, CSPX or
  holdings data in the API.
- Caller-side code (Ballast, acciaux, Atlas plans are separate).
- Journal edit/delete, caller writes other than journal append, multi-user or household sharing of
  the API.
- Applying Vercel Firewall rules (owner action, documented only).
- Editing `AGENTS.md`/`CLAUDE.md`.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; tests cover sealed-box vectors (seal/open, tamper, wrong key, unknown `v`), HMAC canonical string, timestamp window, nonce replay, scope enforcement, key expiry/revocation/rotation overlap (max two active), identical 401 on every auth failure, rate limit, body cap, append-only (UPDATE/DELETE rejected), RPC grants (callable by `service_role` only)
- [ ] `pnpm build` green
- [ ] `pnpm format:check` green
- [ ] Manual: issue a caller, call `/api/v1/summary` and `/api/v1/journal`, open the summary with the caller private key, see the journal event in the timeline after unlock; revoke and confirm 401
- [ ] Manual: confirm no plaintext financial value appears in DB rows or API responses
- [ ] `docs/api/v1.md` + JSON Schemas published; owner applies Vercel Firewall rules
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: new public attack surface (`/api/v1/*`), bounded to ciphertext and metadata;
  touches `assets` only for the budget setting and publish hook.
- **Reversibility**: code is a revert; tables are additive. Dropping them needs a backup spec (§6.3).
- **Backout plan**: revoke all keys, remove routes, leave tables dormant; revert the constitution
  under a new governance spec if the carve-out is withdrawn.

## Open questions

- Retention of `invest_api_audit` (proposal: 90 days, pruned by RPC).
- Whether `journal:meta` needs pagination beyond `since` (proposal: cap 500 rows).
