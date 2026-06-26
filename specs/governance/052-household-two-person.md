---
id: 052
slug: household-two-person
area: governance
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-26
approved: 2026-06-26
shipped: 2026-06-26
impl_pr: direct merge to main (governance-only diff; owner approved + waived PR)
supersedes:
constitution_satisfies:
  - '§7.1'
  - '§7.2'
constitution_overrides:
  - section: '§1.1'
    reason: 'Widens "single Singapore user" to allow two linked accounts to form a household for household-scoped data only. Each account stays single-user + zero-knowledge for its personal vault. HARD change → amendment, not per-spec override.'
  - section: '§1.2'
    reason: '"Each account stays single-user" gains a bounded exception: two accounts may share a household space whose data is encrypted under a shared household key, never readable by the server. Personal vaults unchanged.'
  - section: '§2.3'
    reason: 'Adds a third scoped exception to the requireUserId()→getVaultDekSession() order: household actions call requireUserId()→getHouseholdKhSession() (household key, not personal DEK). Membership-gated, still zero-knowledge.'
  - section: '§5.1'
    reason: 'The PIN/DEK invariant ("DEK lives only in fynfo_vault_dek cookie + memory") gains a sibling: a per-session household key K_h lives only in a new HttpOnly cookie fynfo_household_kh + memory, derived by unwrapping with the existing DEK. No new PIN, no server-persisted raw K_h.'
---

# Spec 052: Two-person household (§1.1 / §1.2 / §2.3 / §5.1 amendment)

## Problem

Fynfo's constitution defines it as a tool for **one** Singapore user (§1.1), and §1.2
states each account stays single-user. Clarence wants a **household** space shared with one
other person — joint goals, big-item purchase savings, travel/budget planning — visible and
editable to **both** members, while each member's **personal** vault stays fully private.

The constitution currently forbids this on four HARD points: §1.1 (single user), §1.2 (each
account single-user), §2.3 (the only sanctioned vault gate is `requireUserId()` →
`getVaultDekSession()`), and §5.1 (the only sanctioned session key is the personal DEK in
`fynfo_vault_dek`). The shared-key cryptography the feature needs — a household key `K_h`
wrapped under each member's DEK, held in a new session cookie — has no legal home until these
four rules are amended. This spec is the gate for the household feature; **no household code
ships until it is approved.**

The full design (topology, key-wrapping crypto, data model, invite handoff, MVP surface) lives
in `docs/superpowers/specs/2026-06-25-household-shared-vault-design.md`. This spec amends only
the constitution to authorize it; it writes no feature code.

## Constitution check

- Amends HARD rules §1.1, §1.2, §2.3, §5.1 per §7.1 (owner self-approval) and §7.2 (HARD rules
  require amendment, not per-spec override).
- Preserves every other HARD invariant: §2.1 (zero-knowledge — household data is AES-256-GCM
  under `K_h`, server never holds raw `K_h`), §5.2 (RLS on every new table), §5.4 (no SQL on
  encrypted columns). These are satisfied, not overridden.
- Per §8.1/§8.2: the agent DRAFTS this amendment; Clarence reviews the diff and approves before
  the `CONSTITUTION.md` + spec commit. Enforcement layer, secrets, and CI are untouched.

## Solution shape

Constitution edits only (no `src/**`, no migrations, no harness):

- **§1.1** — append: Fynfo MAY link **two** accounts into a **household** for household-scoped
  data only. Each account stays single-user and zero-knowledge for its personal vault; the
  household introduces no third party and no server-readable key.
- **§1.2** — narrow "each account stays single-user": add that two accounts MAY share a
  household space encrypted under a shared household key that the server cannot read. Membership
  is capped at two. No merging of personal vaults.
- **§2.3** — add a third scoped, vault-consistent exception: household-data actions call
  `requireUserId()` then `getHouseholdKhSession()` (returns `K_h` from the `fynfo_household_kh`
  cookie) before touching household ciphertext. Identity still first. This is not a public
  action — it is membership-gated.
- **§5.1** — add a sibling invariant for the household key: a per-household random `K_h` is
  stored only **wrapped** (AES-256-GCM under each member's DEK) at rest, lives unwrapped only in
  the HttpOnly cookie `fynfo_household_kh` + process memory, and is never persisted raw nor sent
  to Supabase. No new PIN: `K_h` is unwrapped with the member's existing DEK. The one-time invite
  secret used to bootstrap a second member's wrapped copy is high-entropy, hashed at rest,
  expiring, and consumed on accept.
- **Amendment log + version**: bump `CONSTITUTION.md` to **v3.0** (MAJOR — HARD rules changed per
  §7.1 semver), add the amendment-log row citing this spec.
- **Pointers**: no `AGENTS.md`/`CLAUDE.md` surface change is required (no new skill, no new
  protected path) — §7.1 step 4 only fires if surface changed. Confirm at edit time; if the
  household-key cookie warrants an AGENTS.md "Key files" mention, fold that single-line edit in.

## Out of scope

- The household feature itself — schema, RLS, `K_h` wrap/unwrap crypto, invite/accept flow,
  session cookie, the `/dashboard/household` page, big-item goals. Those are the **next two
  specs** (household core, then MVP page), authored only after this amendment is approved.
- Any change to personal-vault encryption (§2.1), the PIN→DEK derivation itself (§5.1 PBKDF2
  iteration count / salt), RLS mandate (§5.2), or the telemetry carve-out (§2.2/§2.3) — all
  unchanged.
- Three-or-more-member households, personal→household data promotion, client-side WebCrypto
  hardening — explicitly deferred (see design doc §12 open questions).

## Acceptance

- [ ] `CONSTITUTION.md` §1.1, §1.2, §2.3, §5.1 amended exactly as above; version → 3.0; amendment
      log row added citing `specs/governance/052-household-two-person.md`.
- [ ] No `src/**`, `supabase/**`, `.claude/**`, or dependency change in this spec's commit
      (governance-only diff).
- [ ] Spec `status: approved` + `approved_by: Clarence` before the household **core** spec is
      authored.
- [ ] `pnpm check` green (no code touched, but format:check covers the markdown).
- [ ] Spec hash matches at commit time.

## Risk & reversibility

- **Blast radius**: text-only constitutional change. Widens the model by exactly one bounded
  relationship (two-account household) + one session key class (`K_h` / `fynfo_household_kh`),
  both fenced to non-personal, zero-knowledge, membership-gated data. Personal-vault invariants,
  the enforcement layer, and secrets are untouched. No code, schema, or runtime behavior changes
  on this commit.
- **Reversibility**: single `git revert` of the constitution + spec commit. With no code shipped
  against it yet, revert is clean. (Once the core spec ships, reverting this amendment would also
  require unwinding that migration — call out loudly in the core spec, not here.)
- **Backout plan**: revert the amendment commit; the household feature specs re-block on §1.1/§2.3/§5.1.

## Open questions

- [x] Q: Version bump v3.0 (MAJOR) vs v2.1? — Owner: Clarence — A: **v3.0** (HARD rules changed;
      §7.1 semver = MAJOR for HARD), consistent with the v2.0 precedent in gov-013.
- [x] Q: Does the household-key cookie warrant an `AGENTS.md` "Key files" line now, or fold it into
      the core spec when `getHouseholdKhSession()` actually exists? — Owner: Clarence — A: **defer to
      core spec** (the function doesn't exist yet; documenting a non-existent file is drift).
