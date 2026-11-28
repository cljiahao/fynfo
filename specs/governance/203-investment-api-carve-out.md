---
id: '203'
slug: investment-api-carve-out
area: governance
status: draft # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-28
approved: # YYYY-MM-DD, set on owner approval
shipped: # set when the amendment merges
impl_pr: # none expected (governance-only diff); implementation is spec security/204
supersedes:
constitution_satisfies:
  - '§7.1'
  - '§7.2'
  - '§5.2'
  - '§5.4'
constitution_overrides:
  - section: '§2.1'
    reason: 'Adds a sealed-box carve-out: ciphertext sealed to a caller public key or the journal public key counts as zero-knowledge. HARD change, so amendment rather than per-spec override.'
  - section: '§2.2'
    reason: 'Adds /api/v1/* as the only non-session route that may mutate, limited to append-only journal inserts and its own bookkeeping.'
  - section: '§2.3'
    reason: 'Adds a fourth scoped exception for API-key + HMAC callers with no user session and no vault.'
---

# Spec 203: Investment API carve-out (§2.1 / §2.2 / §2.3 amendment)

## Problem

On 2026-11-28 the owner approved a narrow `/api/v1` so his own tools (Ballast, acciaux, Atlas) can
read a user-published investment summary and append to an investment journal, while the server
and Supabase never hold readable financial data. Today that is impossible without breaking HARD
rules: §2.1 requires every financial payload to be DEK-encrypted (a caller has no DEK), §2.2 allows
no mutating API route besides the telemetry carve-out, and §2.3 requires `requireUserId()` +
vault for every data access. Spec 204 is the implementation; **it must not start before this spec
is approved and merged.**

## Constitution check

- Amends HARD rules §2.1, §2.2, §2.3 per §7.1 (owner approval; agents cannot self-approve) and §7.2
  (HARD rules change by amendment, not per-spec override).
- Re-reviewed and left unchanged: §2.4 (pages stay thin), §2.6/§2.7 (barrels, named exports apply
  to the new feature), §3.1 (no new dependency, Node `crypto` only), §3.2 (no `any`, no secrets or
  PII test data), §5.1 and §5.1a (the journal private key is wrapped under the DEK as `K_h` is, with
  no new PIN and no new raw-key persistence), §5.2 (every new table ships RLS-on in the same
  migration), §5.3 (caller keys are issued at runtime, never committed), §5.4 (no SQL on encrypted
  columns; the journal is read and filtered by metadata only), §6.3 (migrations forward-only).
- HARD changes: §2.1, §2.2, §2.3. SOFT changes: none. Version bump 5.0.0 to 6.0.0 (MAJOR).
- §7.1 step 4: `AGENTS.md`/`CLAUDE.md` pointers (their summary of §2.2 route exceptions) are
  protected files and are NOT edited here; the owner decides whether to refresh them in a
  follow-up.
- Per §8.1/§8.2 the agent drafts; the owner reviews the diff and approves before `CONSTITUTION.md`
  and this spec are committed together. The amendment takes effect only on approval and merge of
  this PR.

## Solution shape

Constitution edits only (no `src/**`, no migrations, no harness, no `AGENTS.md`/`CLAUDE.md`).
Exact text is in the diff of `CONSTITUTION.md`; summary:

### §2.1 sealed-box carve-out

Ciphertext from an authenticated sealed-box construction (ephemeral X25519, HKDF-SHA256,
AES-256-GCM) counts as zero-knowledge when sealed to exactly one of: a caller's X25519 **public**
key registered by the owner, or the per-user **journal public key** whose private key is stored
only wrapped under the DEK. The server never holds an opening key. Sealing happens only inside an
unlocked session.

### §2.2 `/api/v1/*` mutation surface

Added to the reserved API route list. The only non-session route family that may mutate, and only
for append-only journal inserts and its own nonce, audit-log and rate-limit bookkeeping. Zod at the
boundary, one opaque error response.

### §2.3 fourth exception

API-key + HMAC callers, no user session, no vault. Data access only through `SECURITY DEFINER`
RPCs with `EXECUTE` granted to `service_role` alone; no direct table grants to callers; callers
receive ciphertext plus non-financial metadata only. "Outside these three" becomes "Outside these
four".

### Version table

Row `6.0.0 | 2026-11-28 | ... Approved by Clarence in specs/governance/203-investment-api-carve-out.md.`

## Out of scope

- Any code, migration or endpoint (spec 204).
- Relaxing §5.2, §5.4 or §3.1; adding billing or multi-tenant behaviour (§1.2 unchanged).
- Any caller reading plaintext financial data server-side, or any caller write other than journal
  append.
- Editing `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `src/**`, `supabase/**`.

## Acceptance

- [ ] `pnpm format:check` green
- [ ] `git diff` of `CONSTITUTION.md` touches only the version header, §2.1, §2.2, §2.3 and one new version-table row
- [ ] Owner approves this PR (sets `approved:` and `status: approved`) before spec 204 implementation starts
- [ ] Spec hash matches at amendment merge time

## Risk & reversibility

- **Blast radius**: first sanctioned machine-callable route into fynfo data. Exposure is bounded
  by design to ciphertext and caller/event-type/time metadata; a full server or Supabase
  compromise still reveals no financial plaintext. The new risks are availability (flooding) and
  caller-key theft, both handled in spec 204.
- **Reversibility**: revert of this PR plus removal of `/api/v1` code. Journal rows already written
  are ciphertext and stay readable by the user while the journal key exists.
- **Backout plan**: revoke all caller keys, delete `src/app/api/v1/**`, revert the amendment under
  a new governance spec (forward-only migration rules, §6.3, apply to dropping the tables).

## Open questions

- Should `AGENTS.md`/`CLAUDE.md` route-exception summaries be refreshed in a follow-up PR after
  approval (§7.1 step 4)?
