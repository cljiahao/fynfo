---
id: 002
slug: component-test-harness
area: infra
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence approved jsdom + Testing Library (defer Playwright, skip Sentry)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§4.2' # enables component/interaction tests, closing the last coverage gap
constitution_overrides:
---

# Spec infra/002: Component test harness (jsdom + Testing Library)

## Problem

Until now the suite was node-only (pure logic seams), so component render + interaction paths had **no**
coverage and render regressions were uncatchable. The audit's "jsdom/RTL decision" was open. Owner
approved adopting it (Playwright/E2E deferred; Sentry skipped on zero-knowledge privacy grounds).

## Constitution check

- Satisfies `§4.2`. **New dev dependencies** (§0.4) — explicitly approved by Clarence: `jsdom`,
  `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. Dev-only;
  no runtime/app dependency added.

## Solution shape

- Add the four dev deps.
- **Per-file environment**, not a global switch: component test files opt in with a
  `// @vitest-environment jsdom` docblock; the node default (fast, no DOM) stays for all the seam
  tests. Each component test imports `@testing-library/jest-dom/vitest` for matchers and registers
  `afterEach(cleanup)` (the suite runs `globals: false`).
- Starter test `test/app/dashboard-error.test.tsx` proves the harness: renders `DashboardError`,
  asserts the message + digest reference, and that "Try again" calls `reset` via `userEvent`. Also
  takes `error.tsx` from 0% → covered.

## Out of scope

- Playwright / E2E (deferred — heavy, low ROI solo, sandbox browser-binary constraints).
- Sentry / error monitoring (skipped — breadcrumbs could leak decrypted data, against the
  zero-knowledge model).
- Backfilling component tests across all features — this lands the harness + one exemplar; coverage
  ratchets up over time.
- AGENTS.md §2 wording (still says "no jsdom/Testing Library") — governance-protected; owner to update
  to "node default + opt-in jsdom per-file" (see PR note).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` (248) + `pnpm build` + `pnpm test:coverage` green.
- [x] jsdom env opt-in per file; node seam tests unchanged.
- [x] New deps are dev-only and approved.

## Risk & reversibility

- **Blast radius**: test tooling only. Per-file env keeps the node tests isolated from jsdom.
- **Reversibility**: remove the deps + the `.tsx` test; `git revert`.
- **Backout plan**: revert the commit; `pnpm install`.

## Open questions

- None.
