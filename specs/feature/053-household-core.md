---
id: 053
slug: household-core
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-26
approved: 2026-06-27
shipped: 2026-06-27
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§1.1' # the two-account household authorized by gov-052
  - '§2.1' # household data sealed AES-256-GCM; server never holds raw K_h
  - '§2.3' # household actions: requireUserId() -> getHouseholdKhSession() (3rd exception)
  - '§5.1' # §5.1a K_h invariant: wrapped-at-rest, cookie-only unwrapped, no new PIN
  - '§5.2' # RLS + GRANT on every new table
  - '§4.2' # gated tests on the key lib + actions
constitution_overrides:
---

# Spec 053 (feature): Household core — membership, key-wrapping crypto, invite handoff

## Problem

`specs/governance/052` authorized a two-person household but shipped no code. This spec builds the
**backend foundation**: the tables, RLS, the household-key (`K_h`) wrap/unwrap crypto, the session
cookie, and the one-time invite/accept handoff that lets a second member obtain `K_h` without a
shared passphrase. No user-facing page and no joint-data tables yet — those are spec 054 (MVP
goals). This is the hard, security-critical layer; it is specified and reviewed before any crypto
code is written.

Design source of truth: `docs/superpowers/specs/2026-06-25-household-shared-vault-design.md`.

## Constitution check

- Satisfies `§1.1` (gov-052 household), `§2.1` (all household payloads AES-256-GCM; raw `K_h` never
  persisted), `§2.3` (the new actions follow `requireUserId()` → `getHouseholdKhSession()`, the third
  sanctioned gate), `§5.1`/`§5.1a` (`K_h` wrapped at rest under each member DEK, unwrapped only into
  the `fynfo_household_kh` cookie, no new PIN), `§5.2` (RLS + GRANT in the same migration), `§4.2`
  (gated key-lib + action tests).
- Overrides: none. No HARD rule is bent — gov-052 already amended §1.1/§2.3/§5.1 to permit exactly
  this. No new dependency (reuses `encryptPayload`/`decryptPayload`, `sealCookie`/`openCookie`,
  `pbkdf2`). One `SECURITY DEFINER` RPC for invite-accept bootstrap — mirrors the existing
  vault-unlock-throttle RPC (`20260602000000`), not a new pattern.

## Solution shape

### Migration `supabase/migrations/20260626000000_add_household.sql`

Three tables (NOT goals — that is spec 054), all RLS-enabled + `GRANT ... TO authenticated`:

- **`households`** — `id UUID PK default gen_random_uuid()`, `name TEXT` (plaintext, non-sensitive),
  `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at`.
- **`household_members`** — `id UUID PK`, `household_id UUID REFERENCES households(id) ON DELETE
CASCADE`, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, `role TEXT CHECK (role IN
('owner','member'))`, `wrapped_kh TEXT NOT NULL` (= `K_h` sealed under this member's DEK via
  `encryptPayload`; the IV/tag live inside that blob, so **no separate iv column** — simplifies the
  design-doc table), `joined_at`. `UNIQUE(household_id, user_id)`.
- **`household_invites`** — `id UUID PK`, `household_id UUID REFERENCES households(id) ON DELETE
CASCADE`, `invite_code_hash TEXT NOT NULL` (SHA-256 hex of the one-time secret `S`, for lookup —
  raw `S` never stored), `kdf_salt TEXT NOT NULL` (base64 PBKDF2 salt), `wrapped_kh_under_invite TEXT
NOT NULL` (= `K_h` sealed under the `S`-derived key), `created_by UUID`, `expires_at TIMESTAMPTZ
NOT NULL`, `consumed_at TIMESTAMPTZ`, `created_at`. Index on `invite_code_hash`.

**Two-member cap:** `BEFORE INSERT` trigger `enforce_household_member_cap()` raising `exception` when
`(SELECT count(*) FROM household_members WHERE household_id = NEW.household_id) >= 2`.

**RLS policies:**

- `households`: `SELECT`/`UPDATE`/`DELETE` where `EXISTS (SELECT 1 FROM household_members m WHERE
m.household_id = households.id AND m.user_id = auth.uid())`; `INSERT WITH CHECK (created_by =
auth.uid())`.
- `household_members`: `SELECT` where the caller is a member of that `household_id` (membership
  visible to both members). `INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM
households h WHERE h.id = household_id AND h.created_by = auth.uid()))` — i.e. only the **owner**
  self-inserts directly; the second member joins via the RPC below (which is `SECURITY DEFINER` and
  bypasses this). `DELETE` where caller is a member (supports leave; re-key handled in a later spec).
- `household_invites`: `ALL` where caller is a member of `household_id` (owner creates/revokes/sees
  invites). The accepter — **not yet a member** — never selects this table directly; they go through
  the RPC.

**`SECURITY DEFINER` RPC `accept_household_invite(p_code_hash TEXT)`** — the bootstrap. Runs as
definer (bypasses RLS) but is safe because it validates everything and returns only what the caller
needs:

1. Look up the invite by `invite_code_hash = p_code_hash` where `consumed_at IS NULL AND expires_at >
now()`. Not found → raise generic `exception` (opaque).
2. Enforce the household still has `< 2` members; else raise.
3. Return `(household_id, wrapped_kh_under_invite, kdf_salt)` to the caller. It does **not** insert
   the member row or consume the invite — the action does that in two follow-up steps so the
   re-wrap-under-B's-DEK happens in app code (the RPC never sees a DEK or raw `K_h`).
4. Companion definer RPC `consume_household_invite(p_invite_id UUID, p_user_id UUID, p_wrapped_kh
TEXT)` — inside one statement: assert invite still open + cap < 2 + `p_user_id = auth.uid()`,
   insert the `household_members` row (`role 'member'`, `wrapped_kh = p_wrapped_kh`), set the
   invite's `consumed_at = now()`. Atomic; re-asserts the cap to close the TOCTOU window.

`GRANT EXECUTE` on both RPCs to `authenticated`.

### `src/lib/household-key.ts` (NEW — pure, gated)

Reuses `crypto.ts` primitives; `K_h` is a 32-byte Buffer used as a DEK.

- `generateKh(): Buffer` — `crypto.randomBytes(32)`.
- `wrapKh(kh: Buffer, key: Buffer): string` — `encryptPayload(kh.toString('base64'), key)`.
- `unwrapKh(wrapped: string, key: Buffer): Buffer` — `Buffer.from(decryptPayload(wrapped, key),
'base64')`; throws `DecryptionError` on tamper/wrong key (inherited).
- `deriveInviteKey(secret: string, saltB64: string): Buffer` — `pbkdf2(secret, base64-decoded salt,
ITERATIONS, 32, 'sha256')`, reusing the iteration constant from `crypto-constants.ts`.
- `hashInviteCode(secret: string): string` — `sha256(secret)` hex, for the lookup column.
- `generateInviteSecret(): { secret: string; saltB64: string }` — `secret` = base64url of 32 random
  bytes (high-entropy, user-transferable); `saltB64` = base64 of 16 random bytes.

### `src/lib/household-cookie.ts` + `getHouseholdKhSession()`

- `HOUSEHOLD_KH_COOKIE = 'fynfo_household_kh'` constant (mirrors `vault-cookie.ts`).
- `getHouseholdKhSession(): Promise<Buffer | null>` in `src/lib/household-keystore.ts` — reads the
  cookie, `openCookie` → base64 → Buffer, returns null on absent/tamper (mirrors
  `getVaultDekSession`). The cookie is **set** inside the unlock/create/accept actions via
  `sealCookie(kh.toString('base64'))` with the same `HttpOnly; Secure; SameSite` attributes the vault
  DEK cookie uses.

### `src/features/household/` (actions + schemas + types + barrel; NO components yet)

Every action: `requireUserId()` first. Then per the §2.3 third exception, household-data actions call
`getHouseholdKhSession()` (not `getVaultDekSession`) — except `createHousehold`/`unlockHousehold`/
`acceptInvite`, which need the **personal DEK** (`getVaultDekSession()`) to wrap/unwrap `K_h`, then
set the household cookie. All inputs validated with Zod via `parseOrThrow`.

- `createHousehold(name)`: `requireUserId` → `getVaultDekSession` (need DEK) → `generateKh()` →
  insert `households` row → insert owner `household_members` row with `wrapped_kh = wrapKh(kh, dek)` →
  `sealCookie` the `K_h` into `fynfo_household_kh`. Returns `{ householdId }`.
- `getHousehold()`: `requireUserId` → read the caller's membership + household (RLS-scoped). Returns
  `{ household, members } | null`. No DEK/K_h needed (metadata only).
- `unlockHousehold()`: `requireUserId` → `getVaultDekSession` → read own `wrapped_kh` →
  `kh = unwrapKh(wrapped_kh, dek)` → `sealCookie` into `fynfo_household_kh`. Mirrors vault unlock; no
  new PIN entry. Returns `{ ok: true }`.
- `createInvite()`: `requireUserId` → `getVaultDekSession` → must be owner with an unlocked `K_h`
  (unwrap own `wrapped_kh`) → `generateInviteSecret()` → insert `household_invites` row with
  `invite_code_hash = hashInviteCode(secret)`, `kdf_salt`, `wrapped_kh_under_invite =
wrapKh(kh, deriveInviteKey(secret, salt))`, `expires_at = now + INVITE_TTL`. Returns the raw
  `secret` **once** (shown to the owner to hand off out-of-band). Raw `S` is never persisted.
- `acceptInvite(secret)`: `requireUserId` → `getVaultDekSession` (need own DEK to re-wrap) → call
  `accept_household_invite(hashInviteCode(secret))` RPC → `kh = unwrapKh(wrapped_kh_under_invite,
deriveInviteKey(secret, kdf_salt))` → `wrapped_for_self = wrapKh(kh, dek)` → call
  `consume_household_invite(inviteId, userId, wrapped_for_self)` RPC → `sealCookie` `K_h`. Returns
  `{ householdId }`.
- `constants.ts`: `INVITE_TTL_HOURS = 48`, `HOUSEHOLD_MEMBER_CAP = 2`.
- `schemas.ts`: Zod for `name` (1-80 chars), `secret` (base64url length-bounded).
- `index.ts`: barrel (per §2.6) exporting the actions + types only.

### Error opacity (§4 / spec-002 pattern)

Every Supabase error wrapped via the existing `handle-api-error`/`AppError` path — no table/constraint
text leaks. Invalid/expired/consumed invite → a single opaque "invite not valid" message.

## Out of scope

- The `/dashboard/household` **page**, nav entry, hooks, and `household_goals` /
  `household_goal_contributions` tables + the big-item-goal UI — **spec 054** (MVP).
- Member removal / household dissolution **re-key** (`K_h` rotation + re-encrypt) — its own later
  spec; `DELETE` on membership is allowed now but does not yet rotate `K_h` (design-doc open Q).
- Client-side WebCrypto wrapping (stronger ZK) — deferred per design-doc §12.
- Any change to the personal vault, its cookie, or PBKDF2 derivation.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] **`household-key.ts` gated** in `vitest.config.ts` (lines/statements 95, functions 100,
      branches 85 — matching the spec-049 lib gates): round-trip `wrapKh`/`unwrapKh` (correct key
      recovers `K_h`; wrong key / tampered blob → `DecryptionError`); `deriveInviteKey` deterministic
      for same `(secret, salt)`, differs across salts; invite-key wrap/unwrap round-trip.
- [ ] Action tests (node-env, `fake-supabase` helper, per specs 035-037): `createHousehold` inserts
      household + owner member with a non-empty `wrapped_kh` and sets the cookie; `unlockHousehold`
      recovers the same `K_h`; `createInvite` returns a secret and stores only its hash;
      `acceptInvite` happy-path re-wraps + consumes; expired/consumed/unknown invite → opaque error;
      the member-cap path rejects a third member.
- [ ] Migration applies cleanly against a fresh local DB; RLS denies a non-member SELECT on all three
      tables; the cap trigger rejects a third member; both RPCs `EXECUTE`-grant to `authenticated`.
- [ ] No `any`, no `console.log`, no new dependency, no governance-path edit.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: entirely additive — three new tables, one new feature module, two new lib files,
  one new cookie. No existing table, action, or the personal vault is touched. A bug isolates to the
  household surface, which has no UI yet.
- **Reversibility**: revert the impl commit; the migration is forward-only (§6.3) so a rollback needs
  a companion `DROP` migration (tables are new + empty in prod → low risk). Call out: do **not**
  reuse the migration timestamp on re-apply.
- **Backout plan**: revert code commit; if migration already ran in prod, ship a `DROP TABLE
household_invites, household_members, households CASCADE;` migration (safe while unused).

## Open questions

- [x] Q: Split the invite-accept into the two RPCs as described, or one combined `SECURITY DEFINER`
      that takes the re-wrapped blob and does validate+insert+consume atomically? — Owner: Clarence —
      A: **two-step** (read-then-consume) so the re-wrap-under-B's-DEK stays in app code and neither
      RPC ever receives a DEK; the `consume` RPC re-asserts the cap to close TOCTOU. (approved)
- [x] Q: `INVITE_TTL_HOURS = 48` acceptable, plus an explicit owner "revoke invite" action now or in
      054? — Owner: Clarence — A: **48h now**; revoke folds into 054 with the rest of the UI. (approved)
- [x] Q: Should `unlockHousehold` auto-run when the personal vault unlocks (one unlock for both), or
      stay an explicit separate step on the household page? — Owner: Clarence — A: **explicit** on the
      household page for now (smaller blast radius; the page is 054), revisit for UX later. (approved)
