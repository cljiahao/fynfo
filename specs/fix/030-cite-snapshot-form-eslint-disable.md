---
id: 030
slug: cite-snapshot-form-eslint-disable
area: fix
status: shipped
author: Claude (Opus 4.8)
created: 2026-06-06
approved: 2026-06-06
shipped: 2026-06-06
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§4.1'
constitution_overrides:
  - section: none
---

# Spec 030: Cite the snapshot-form exhaustive-deps disable

## Problem

`src/features/assets/components/snapshot-form.tsx:93` carries a bare
`// eslint-disable-next-line react-hooks/exhaustive-deps` with no justification.
AGENTS §3 / quality gate: "no `eslint-disable` without inline spec citation." The
disable itself is legitimate (see below) but the missing citation is governance
drift — lint passes only because the disable suppresses the warning.

## Why the disable is correct (kept, not removed)

The prefill effect:

```ts
useEffect(() => {
  if (!editId && allSnapshots) {
    form.reset({ id: defaultMonth, entries: buildInitialEntries() });
  }
}, [allSnapshots, editId]);
```

must fire only when `allSnapshots` finishes loading or `editId` flips. Omitted
deps are intentional:

- `form` — React Hook Form returns a stable ref; safe to omit.
- `buildInitialEntries` — new identity every render; including it (or `form`)
  would re-run `form.reset` on unrelated renders and clobber in-progress user
  edits.

Refactoring to satisfy the rule (e.g. `useCallback` on `buildInitialEntries` +
listing `form`) adds churn with no behavior benefit and risks reintroducing the
clobber. The rule's intent — a documented, justified disable — is met by adding
the citation.

## Solution shape

- `snapshot-form.tsx`: add a justification comment above the existing disable,
  citing this spec. Code behavior unchanged (comment-only).

## Out of scope

- The second effect (`[existing]`, line ~97) — no disable, untouched.
- Any refactor of the prefill / field-array logic.

## Acceptance

- [x] `pnpm check` green (lint still passes; disable now cited).
- [x] `pnpm test:ci` green.
- [x] No behavior change (comment-only edit).
- [x] Disable line now carries an inline rationale + `specs/fix/030` citation.

## Risk & reversibility

Comment-only; zero runtime impact. Revert via `git revert`.
