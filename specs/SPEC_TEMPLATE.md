---
id: NNN
slug: short-slug
area: feature | fix | refactor | governance | infra
status: draft # draft | approved | shipped | superseded
author: <agent or human name>
created: YYYY-MM-DD
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes: # spec id, if applicable
constitution_satisfies:
  - '§X.Y'
constitution_overrides: # SOFT only; HARD requires governance/ spec first
  - section: '§X.Y'
    reason: ''
---

# Spec NNN: <title>

## Problem

What hurts today. One short paragraph. Concrete user-visible pain, not vague tech-debt.

## Constitution check

- Satisfies: `§X.Y`, `§A.B`
- Overrides: none, or list with reasoning here.

If this spec touches any `HARD` rule, link the `governance/` amendment spec that authorized the change. If none exists, stop and write that first.

## Solution shape

Bullets. Interfaces, data flow, key decisions. Not code.

- Module / file additions and edits (paths)
- Data model changes (Supabase migration filename, columns, RLS policy delta)
- Public API of new components / hooks / actions
- Encryption-touching code paths flagged explicitly

## Out of scope

What this does NOT do. Critical for bounding agent work.

## Acceptance

Concrete, testable checklist. Each item maps to a quality gate or manual verification step.

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green; new tests cover ...
- [ ] `pnpm build` green
- [ ] Manual: ...
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: which features / data / users affected if wrong.
- **Reversibility**: revert is a single git revert / requires migration rollback / irreversible (call out loudly).
- **Backout plan**: explicit steps.

## Open questions

Anything the spec author cannot decide alone. Each question gets an owner and a resolution before approval.

- [ ] Q: ... — Owner: ... — A: ...
