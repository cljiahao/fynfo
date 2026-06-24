# Household Shared Vault — Design

**Date:** 2026-06-25
**Author:** Clarence + Claude (brainstorming session)
**Status:** Design — not yet implemented. Source of truth for the phased specs below.

---

## 1. Problem

Fynfo today is a single-user, zero-knowledge personal wealth vault. Clarence wants a **household
view** shared with one other person (a partner): a place for genuinely _joint_ financial things —
saving toward big purchases, travel budgets, joint planning, household budgets — visible and editable
to **both** people, while each person's **personal** vault stays completely private.

The hard part is not the UI. It is that Fynfo is **zero-knowledge**: each person's data is encrypted
with a key derived from _their own_ PIN; the server cannot read it, and neither can the other person.
So a shared view requires a deliberate **shared-key** mechanism — there is no way for one person to
read the other's encrypted data without one.

## 2. Goals / Non-goals

**Goals**

- A shared household space for _new_ joint data, live and current for both members.
- Preserve zero-knowledge: the server never stores a key that can read household data.
- No second passphrase to remember (the friction Clarence explicitly rejected).
- Each member uses only their **own existing PIN**.
- Personal vaults are 100% untouched.

**Non-goals (now)**

- Merging the two people's _existing personal_ budgets/plans. Household data is new and separate.
- More than two members (constitution caps the household at two).
- Self-hosting / infra changes (Task 1 was decided separately: **stay on Vercel**).
- Replacing the existing expense-split / "Who Owes You" reconciliation (that stays personal).

## 3. Topology

One Fynfo deployment, one Supabase project, **two accounts** (two `user_id`s) linked into a
**household**. This makes membership + RLS straightforward; the cryptographic key-sharing problem is
the only genuinely new hard piece.

## 4. Cryptographic design — key-wrapping (chosen)

A single random **household key `K_h`** encrypts all household data. `K_h` is stored **wrapped**
(encrypted) once per member, under that member's PIN-derived key (DEK). Either member unlocks `K_h`
with their **own normal PIN**; the server only ever holds the wrapped blobs and never the raw `K_h`
at rest.

```
K_h            = random AES-256 key (generated once, at household creation)
wrapped_for_A  = AES-256-GCM( K_h, key = A's DEK )
wrapped_for_B  = AES-256-GCM( K_h, key = B's DEK )
household data = AES-256-GCM( field, key = K_h )
```

- A logs in (PIN → A's DEK, as today) → unwraps `K_h` → decrypts household data.
- B logs in (PIN → B's DEK) → unwraps `K_h` → decrypts the same household data.
- Because both encrypt/decrypt under the _same_ `K_h`, a **live** shared view is natural — no
  cross-key merging.

This reuses the existing crypto posture: wrap/unwrap runs in server actions using the session DEK
read from the `fynfo_vault_dek` HttpOnly cookie (same transient-handling model as every existing
`encryptPayload`/`decryptPayload` call). The unlocked `K_h` is held for the session in a new
HttpOnly cookie `fynfo_household_kh`, mirroring the vault-DEK pattern.

> **Stronger-ZK option (flagged, not MVP):** do the wrap/unwrap in the browser via WebCrypto so the
> server never sees raw `K_h` even transiently. Deferred — it is a larger change and inconsistent
> with the current server-side crypto path. Revisit if the threat model tightens.

### 4.1 The initial-handoff problem and solution

When A _creates_ the household, A can wrap `K_h` for themselves but **cannot** wrap it for B — that
needs B's DEK (B's PIN), which A never has. So `K_h` must reach B's device **once**, securely, at
setup:

1. A's client generates a one-time, high-entropy **invite secret** `S` (shown to A as a short
   code/link).
2. `K_h` is wrapped under a key derived from `S` → stored as a one-time `household_invites` row
   (with a hash of `S`, an expiry, and a consumed flag). Raw `S` is never stored.
3. A shares `S` with B **out-of-band** (text, in person) — once.
4. B accepts: B supplies `S` → `K_h` is unwrapped from the invite → **re-wrapped under B's DEK** →
   stored as `wrapped_for_B`. The invite row is consumed/deleted.

After setup, **each person only ever uses their own PIN** — `S` is one-time onboarding, _not_ a
standing passphrase, so it carries no forget-risk.

## 5. Data model (Supabase)

New tables, all RLS-scoped to "the caller is a member of this household":

| Table                                | Key columns                                                                                      | Encryption                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `households`                         | `id`, `name`, `created_by`, `created_at`                                                         | `name` plaintext (non-sensitive)                 |
| `household_members`                  | `household_id`, `user_id`, `role` (`owner`/`member`), `wrapped_kh`, `wrapped_kh_iv`, `joined_at` | `wrapped_kh` = `K_h` under member DEK            |
| `household_invites`                  | `id`, `household_id`, `wrapped_kh_under_invite`, `invite_code_hash`, `expires_at`, `consumed_at` | `K_h` under invite secret                        |
| `household_goals` (MVP)              | `id`, `household_id`, `name`, `target_amount`, `target_date`, `created_at`                       | `name`/`target_amount`/`target_date` under `K_h` |
| `household_goal_contributions` (MVP) | `id`, `goal_id`, `contributor_user_id`, `amount`, `date`, `note`                                 | `amount`/`note` under `K_h`                      |

**RLS:** every `household_*` read/write policy checks `EXISTS (SELECT 1 FROM household_members m
WHERE m.household_id = <row>.household_id AND m.user_id = auth.uid())`. Membership is capped at two
rows per household (enforced in the join action + a check).

## 6. MVP surface — big-item purchase goals

Chosen because it is the **smallest** surface that proves the key-wrapping architecture end-to-end,
is unmistakably joint, reuses nothing that would collide with the personal expense-split feature, and
delivers visible motivation (progress bars).

- **Create goal:** name, target amount, optional target date.
- **Log contribution:** amount, date, optional note, attributed to the contributing member.
- **View:** list of goals, each with total contributed / target, a progress bar, and who contributed
  what. Live for both members.
- Pure progress math (sum contributions, % of target, remaining) extracted to a gated `lib/` module
  and unit-tested (consistent with specs 049 / 035-039).

Later surfaces (each its own spec): **travel budgets** (a goal with line-items), **joint plan**
(reuses planner math), **shared budget/expenses** (only if splits prove insufficient).

## 7. UI / flow

- New route `src/app/dashboard/household/page.tsx`, nav entry alongside existing dashboard pages.
- **First visit / no household:** "Create a household" or "Join with an invite code."
- **Has household, locked:** "Unlock household" — uses the already-present session DEK to unwrap
  `K_h` into the `fynfo_household_kh` cookie. No new PIN entry.
- **Unlocked:** goals list + create-goal + add-contribution, following the existing feature module
  layout (`features/household/{actions,components,hooks,lib,types,schemas}`).
- **Invite/accept** screens for onboarding the second member.

## 8. Governance

Changes Fynfo's "single Singapore user" (constitution §1.1) to allow a **two-person household of
linked accounts** for household-scoped data only. Personal vaults, the telemetry carve-out, and the
zero-knowledge posture for personal data are unchanged. This requires a `specs/governance/` amendment
**approved by Clarence before any code** (per AGENTS.md §0 / constitution §8.2).

## 9. Phased roadmap (each = its own spec)

1. **Governance amendment** — constitution §1.1 → two-person household. (human-approved)
2. **Household core** — schema + RLS + key-wrapping crypto (`K_h` generate / wrap / unwrap) + the
   one-time invite/accept handoff + `fynfo_household_kh` session cookie. _Foundational, the hard one._
3. **Household MVP page** — `/dashboard/household` + big-item purchase goals (create / contribute /
   progress) + gated progress-math lib + tests.
4. **Later** — travel budgets → joint plan → shared budget, as desired.

## 10. Security analysis

- **At rest:** server stores only `wrapped_for_A`, `wrapped_for_B`, and (transiently) an invite blob.
  Raw `K_h` is never persisted. A Supabase data breach yields ciphertext only — household data stays
  protected, same as personal vaults.
- **In transit/processing:** wrap/unwrap occurs server-side using the session DEK from the HttpOnly
  cookie — identical transient-exposure model to all existing Fynfo crypto. (WebCrypto client-side is
  the flagged hardening option.)
- **Invite secret:** high-entropy, one-time, hashed at rest, expiring, consumed on accept. Out-of-band
  transfer between two trusted people.
- **Membership:** RLS gates every household row on membership; two-member cap enforced.
- **Open risk:** member removal / household dissolution should **re-key** (`K_h` rotation +
  re-encrypt) so a removed member's wrapped key is invalidated — see open questions.

## 11. Testing

- Pure `K_h` wrap/unwrap round-trip + invite wrap/unwrap unit tests.
- Goal progress math: gated `lib/` module, per-file coverage threshold (per spec 049 pattern).
- RLS / membership behavior on the new actions (node-env, fake-supabase helper as in specs 035-037).
- Component render test for the goals list (jsdom, per spec 050 pattern).

## 12. Open questions (resolve before/within the relevant spec)

- [ ] **Member removal / dissolution:** rotate `K_h` and re-encrypt on removal, or accept that a
      removed member retains their old wrapped key until rotation? (Lean: support explicit re-key.)
- [ ] **Invite lifetime:** expiry window + manual revoke before accept.
- [ ] **`K_h` handling location:** server-side (MVP, consistent) vs client-side WebCrypto (stronger
      ZK, larger build). Lean server-side for MVP, revisit.
- [ ] **Personal → household promotion:** out of scope now, but is "copy a personal goal into the
      household" wanted later?
