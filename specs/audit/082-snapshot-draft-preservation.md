---
id: '082'
area: audit
status: owner-authorized
created: 2026-10-09
author: Codex
shipped:
impl_pr:
constitution_satisfies: ['§2.4', '§2.5', '§4', '§7.4']
---

# Snapshot drafts survive background refreshes

## Authorization and evidence

Clarence's full audit/remediation request and sequential roadmap authorization
cover this reversible UI bug fix under §7.4. SnapshotForm currently resets new
forms whenever snapshot history changes, and edited forms whenever the individual
query changes. TanStack Query refetches can therefore overwrite unsaved fields.
Atomic saves in spec077 do not prevent this client-side loss or stale writes.

## Scoped batch

Change `src/features/assets/components/snapshot-form.tsx`, its existing interaction
tests, `vitest.config.ts`, README and roadmap records. Background results may refresh an untouched
editor, but must not replace a dirty draft. Explicit navigation to another editor
context initializes that context even after a dirty draft. This also preserves
freshness when the first result came from a stale query cache.
Keep initial account prefilling, blank new amounts, category rows, validation,
save behavior and assets redirect. Remove obsolete effect suppression only if its
dependencies can be expressed directly without changing initialization behavior.
No schema, dependency, crypto, protected file, new control or styling change.
Removing the obsolete effect suppression exposes React Compiler's existing
`form.watch()` incompatibility. Use RHF's `useWatch` subscriptions for month and
entries, retaining category totals and row behavior without adding a suppression.
Subscriptions are established before initialization effects, matching the
[maintainer's useWatch implementation](https://github.com/react-hook-form/react-hook-form/blob/master/src/useWatch.ts).
Verification reproduced two existing expense UI timeouts with four workers
(252.59 seconds). The full identical suite passed with two workers (196.56
seconds), keeping 5-second timeouts, assertions, isolation and coverage floors.
Cap the default worker count at two to reduce measured host contention; this is
one observed comparison, not a universal benchmark or proof no flakes remain.
No application-latency improvement is claimed. Follow
[Vitest's measured configuration guidance](https://vitest.dev/guide/improving-performance.html).

Use Impeccable harden guidance: preserve work during concurrent operations and
network activity; Operate mode preserves incumbent controls and visual identity.
The context loader's unrelated credential checks remain excluded by the owner's
privacy instruction. No installation or design/harness files are changed.

## Verification and rollback

Regressions must fail before the fix: new draft month/account/amount survive a
changed history query; an edited draft survives a changed individual query.
Prove route/context changes still initialize fresh data. Run all gates in the
isolated synthetic fixture, retain every coverage metric above80% and existing
security floors, then second review and green CI before merge. No layout changes
are claimed; component interaction proof is distinct from full browser workflows.
Revert source/test changes to roll back; stored records are untouched.

## Limits

This preserves drafts rather than resolving database write conflicts. Stale-edit
compare-and-save and uncertain write outcomes remain the next scoped contract.
Do not automatically retry ambiguous failed mutations or claim durable idempotency.

## Verification and second review results

Both dirty-draft regressions failed against the original form: the selected new
month reset to the current month, and an edited amount123 reset to999. They pass
after remediation. Additional cases prove untouched cached data refreshes and
explicit navigation between two existing records and new-entry mode initializes
the intended values. Existing prefill, totals, add/remove, duplicate, save,
delete and assets-return interactions pass (14 targeted tests).

The full two-worker synthetic suite passes115files/889tests, with92.92%lines,
92.66%statements,90.17%functions and87.69%branches. All security floors pass
unchanged. Second review corrected the initially overbroad freeze of untouched
forms, checked dirty/default value transitions, record-context changes, subscription
order, category totals and the removed stale suppression. README/comments match
the behavior. UI markup/styles and security gates are unchanged. Browser workflow
proof remains separate; these are real RHF/React Query component interactions.

Spec083's distinct revision migration was approved by Clarence on2026-10-09;
its implementation starts after this batch merges, not inside this PR.
