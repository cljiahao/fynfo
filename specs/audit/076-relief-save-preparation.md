---
id: '076'
status: shipped
shipped: 2026-10-09
impl_pr: https://github.com/cljiahao/fynfo/pull/11
created: 2026-10-09
author: Codex
---

# Prepare tax-relief replacements before deletion

## Owner authorization and evidence

Clarence's whole-project audit request and roadmap072 authorize this existing
save-contract correction under constitution §7.4. `upsertTaxReliefs` deletes a
year before encrypting its new amounts. An encryption failure can therefore
remove the saved rows without replacements. Duplicate relief keys pass the
array boundary but violate the existing UNIQUE(user_id, year, relief_key),
also after deletion. Snapshot and expense replacements already prepare their
ciphertext before writes; tax reliefs should follow that existing pattern.

## Recorded paths and contract before implementation

Update `src/features/salary/actions/relief-actions.ts`, salary `schemas.ts`,
`test/features/salary/relief-actions.test.ts`, README and roadmap progress.
Include the review-only proposal `specs/fix/077-atomic-financial-replacements.md`;
no executable migration or RPC caller is part of this remediation batch.
Validate the whole replacement list, including unique keys, before any database
access. After identity/vault verification, prepare every encrypted insert before
deleting existing rows. Keep empty-list clearing, owner/year filters, public
return contracts and opaque database errors. No new dependencies, migrations,
keys, cryptographic protocol or protected-file changes (§2/§3/§5).

## Acceptance and rollback

Prove regressions red on original source: a later encryption failure and duplicate
keys must each cause zero database mutations. Confirm valid replacement payloads,
owner/year deletion filters, empty clearing and no insertion after failed delete.
Retain existing ciphertext and opaque insert-error regressions. Run all gates in
the isolated nonsecret fixture, preserving >80% aggregate coverage and stricter
configured floors. Perform a second review and check README/comments before PR.
Merge only with green CI under standing owner authorization. Revert code to roll
back; no stored data is migrated.

## Limits and next approval

Delete and insert remain separate transactions: insert failure or concurrent
writers can still lose/interleave rows. This preparation fix is not atomicity,
optimistic concurrency or retry idempotency. Draft a separately scoped transaction
spec for snapshots, expenses and reliefs; do not implement a SQL migration without
owner approval. Review direct RPC/RLS boundaries as well as server-action gates.

## Guidance

Apply the inspected project `.claude/skills/next-verify/SKILL.md` gate workflow
inside the isolated fixture to honor the owner's secret exclusion. Backend-only
work does not invoke unavailable templateCentral/frontend-design skills or alter
the harness. Transaction proposals use authoritative PostgREST/Supabase contracts.

## Results and second review

Two regressions failed on original source: encryption failure had already reached
the delete query, and duplicate-key input resolved instead of rejecting. Both
now pass, along with successful encrypted replacement, empty clearing, owner/year
filters and opaque write failures. The parsed replacement list is used for
encryption; uniqueness matches the existing case-sensitive database constraint.
The current relief dialog builds a key-indexed Map, closes only on successful
save and preserves its input on failure. No UI, derivation or key-session change.

Full isolated gates pass111files/855tests with92.90%lines,92.67%statements,
90.14%functions and87.44%branches. All existing thresholds remain unchanged.
Formatting, route logging, lint, typecheck and optimized build pass. Second review
checked preparation order, empty clearing, auth/vault guards, validation logging,
consumer failure handling and README's residual non-atomic-save warning.
No confidential records or real secret env files were accessed.

Spec077 is a draft proposal only. Its invoker/owner/RLS contract and transactional
rollback behavior were researched with primary Supabase/PostgREST/PostgreSQL
documentation. Migration implementation approval was requested separately; no
SQL, RPC caller, service-role financial access or production operation occurred.
PR11 merged on2026-10-09 after all CI and preview checks passed, as
9d7f5a456a837be516727d064eaef0780e51da9c. Spec077 remains draft and unimplemented.
