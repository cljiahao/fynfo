---
id: '197'
slug: household-up-to-four
area: governance
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-25
approved: 2026-11-25
shipped: 2026-11-25
impl_pr: # none expected (governance-only diff)
supersedes: # extends governance/052 (two-person household); does not supersede it
constitution_satisfies:
  - '§7.1'
  - '§7.2'
constitution_overrides:
  - section: '§1.1'
    reason: 'Raises the household cap from two linked accounts to four. HARD change, so amendment rather than per-spec override.'
  - section: '§1.2'
    reason: 'The bounded exception to "each account stays single-user" widens from two to four accounts.'
---

# Spec 197: Households of up to four members (§1.1 / §1.2 amendment)

## Problem

On 2026-11-25 the owner decided a household may hold up to **four adult members**, each with
their own login, and that children are **dependents without accounts**. Constitution §1.1 and
§1.2 hard-code "two" accounts and "capped at two"; spec 052 authorized exactly that shape. The
cap also lives in the database (`enforce_household_member_cap`,
`supabase/migrations/20261008000001*`) and no household code may raise it until the
constitution allows it. Spec 200 is the implementation; **it must not start before this spec is
approved.**

## Constitution check

- Amends HARD rules §1.1 and §1.2 per §7.1 (owner approval, agents cannot self-approve) and
  §7.2 (HARD rules change by amendment, not per-spec override).
- Re-reviewed and left unchanged, because they speak of "a member" or "household data" with no
  count: §2.3 item 3 (`requireUserId()` then `getHouseholdKhSession()`), §5.1a body except the
  phrase and sentence below, §5.2 (RLS), §5.4 (no SQL on encrypted columns), §2.1 (zero-knowledge).
- §5.1a gets a one-phrase fix ("a second member's" becomes "a new member's", since the invite flow
  now runs up to three times per household) and one added sentence on membership change.
- HARD changes: §1.1, §1.2, §5.1a. SOFT changes: none.
- Per §8.1/§8.2 the agent drafts; the owner reviews the diff and approves before `CONSTITUTION.md`
  and this spec are committed together. This spec edits no protected file itself.

## Solution shape

Constitution edits only (no `src/**`, no migrations, no harness, no `AGENTS.md`/`CLAUDE.md`).

### §1.1 (line 20)

Before:

> Fynfo MAY link **two** accounts into a **household** for household-scoped data only (joint goals, shared planning). Each linked account stays single-user and zero-knowledge for its **personal** vault; the household introduces no third party and no server-readable key. Household data is encrypted under a shared household key the server cannot read (§5.1). Authorized by `specs/governance/052-household-two-person.md`.

After:

> Fynfo MAY link up to **four** accounts into a **household** for household-scoped data only (joint goals, shared planning). Each linked account is an adult with their own login, stays single-user and zero-knowledge for its **personal** vault; the household introduces no third party and no server-readable key. Children and other dependents are never accounts: they MAY appear only as labels inside household data encrypted under the household key. Household data is encrypted under a shared household key the server cannot read (§5.1). Authorized by `specs/governance/052-household-two-person.md` and `specs/governance/197-household-up-to-four.md`.

### §1.2 (line 29), last sentence only

Before:

> **Exception (§1.1 household):** two accounts MAY share a household space whose data is encrypted under a shared household key the server cannot read; membership is capped at two and no personal vaults are merged.

After:

> **Exception (§1.1 household):** up to four accounts MAY share a household space whose data is encrypted under a shared household key the server cannot read; membership is capped at four, each account belongs to at most one household, and no personal vaults are merged.

### §5.1a (line 168)

Phrase change. Before: "The one-time invite secret that bootstraps a second member's wrapped copy is ..."
After: "The one-time invite secret that bootstraps a new member's wrapped copy is ..."

Sentence appended at the end of §5.1a:

> **Membership change:** adding a member wraps the current `K_h` under that member's DEK. Removing a member, or a member leaving, MUST be accompanied by `K_h` rotation (new `K_h`, all household ciphertext re-encrypted, remaining members re-wrapped) under its own spec; until that spec ships, no leave or remove action exists.

### Version and log

Bump `CONSTITUTION.md` **4.1.1 to 5.0.0** (MAJOR, HARD rules changed, per §7.1 semver) and add an
amendment-log row citing this spec. Update the header "Effective" date to the commit date.

## Threat model

- **Zero-knowledge unchanged.** `K_h` is already stored wrapped per member
  (`household_members.wrapped_kh`, AES-256-GCM under each member's DEK). Going from two to four
  adds up to two more wrapped copies; the server still never holds a raw `K_h` or any DEK, and
  no SQL touches encrypted columns.
- **Larger trust set.** Every member can read and edit all household data. Four adults means more
  devices, PINs and cookies that can leak `K_h`. Household data excludes personal vaults; the
  owner accepts the wider set.
- **Invite flow.** Unchanged in kind (high-entropy, hashed, expiring, consumed once); it may now
  run up to three times. Acceptance is rejected while the household is full, enforced by the cap
  trigger once raised to four.
- **Member removal and leaving (design doc 2026-06-25 §10 and §12 open risk).** Today there is no
  leave or remove action. The only path is the RLS policy "Member leaves own row"
  (`20260626000000_add_household.sql:125-127`, `FOR DELETE USING (user_id = auth.uid())`),
  reachable only by calling Supabase directly. A leaver is blocked by RLS from reading future
  ciphertext, but keeps the old `K_h` (cookie and any copy) and any ciphertext already downloaded,
  while the remaining members continue on an unrotated key. With two members this was a corner
  case; with four, member churn is realistic.
  - **Option A (recommended).** Ship the cap at four with leave and remove **disabled**; spec
    200's migration drops the self-DELETE policy so the database matches the UI. Document the
    limitation. Rotation and re-sealing (new `K_h`, re-encrypt every household table, re-wrap per
    remaining member, invalidate old cookies) becomes a later spec, and leave/remove ships only with it.
  - **Option B.** Allow leave now and treat the old `K_h` as known to the leaver. Not
    recommended: a departed adult keeps read capability over anything they retained, and the later
    rotation spec would retrofit a state that already shipped.
  - **Option C.** Ship rotation first, then the cap increase. Safest ordering but delays the
    owner's request for a feature that works without removal.

## Out of scope

- Every code, schema and UI change (spec 200).
- `K_h` rotation, member removal, leaving, household dissolution (future spec).
- Dependents as accounts. Dependents are labels only; whether a label ships is decided in spec 200.
- More than four members, multiple households per user, personal-to-household data promotion.
- Any change to §2.1, §2.3, §5.1 (PBKDF2), §5.2 or §5.4.

## Acceptance

- [x] `CONSTITUTION.md` §1.1, §1.2, §5.1a edited exactly as written above; version 5.0.0;
      amendment log row added citing this spec.
- [x] No `src/**`, `supabase/**`, `.claude/**`, `AGENTS.md`, `CLAUDE.md` or dependency change in
      the commit.
- [x] `status: approved` and `approved:` date recorded in the frontmatter before spec 200 is
      approved.
- [x] `prettier --check` passes on both specs; `pnpm format:check` green.

## Test plan

Documentation-only. Diff review of the three edited passages against the Before/After text, plus
`pnpm format:check`. No runtime behavior changes, so no unit tests. Behavioral proof of the new
cap is spec 200's migration and tests.

## Risk & reversibility

- **Blast radius.** Text-only. Widens the household relationship by two seats and adds one
  sentence on membership change. Personal-vault invariants, the enforcement layer and secrets are
  untouched.
- **Rollback.** Single `git revert` of the constitution + spec commit. After spec 200 ships, also
  revert its migration (cap back to 2; the migration guard fails loudly if any household holds
  more than two members).

## Open questions

- [x] Q: Removal/rotation: Option A (disable leave and remove, drop the self-DELETE policy,
      rotation later), B or C? — Owner: Clarence — Recommendation: **A**. Owner approved 2026-11-25 (accepted recommendation).
- [x] Q: Version 5.0.0 (MAJOR per §7.1 for HARD changes)? — Owner: Clarence — Recommendation: yes. Owner approved 2026-11-25 (accepted recommendation).
- [x] Q: Keep the §1.1 sentence allowing dependents as encrypted labels, or stay silent on
      dependents? — Owner: Clarence — Recommendation: keep; it fences dependents to labels. Owner approved 2026-11-25 (accepted recommendation).
