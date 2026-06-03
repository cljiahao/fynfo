---
id: 008
slug: code-debt-cleanup
area: refactor
status: approved # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-03)
created: 2026-06-03
approved: 2026-06-03 # owner: "relook for code debt and code smell, fix them"
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§4.1' # DRY/structure cleanups; no behavior change
constitution_overrides:
---

# Spec refactor/008: Code-debt cleanup pass

## Problem

A targeted audit (post-decomposition) surfaced a handful of small, concrete
debts: duplicated SSR-safe localStorage helpers, two route literals bypassing
`PAGE_ROUTES`, an exported-but-internal-only function, the unsafe
`process.env.NEXT_PUBLIC_SUPABASE_*!` pattern duplicated across three files,
misleading server-log error labels, and a missing test on the
Supabase-error-leak-prevention seam. None are bugs; all are clean-up.

## Constitution check

- Satisfies: `§4.1` (DRY + structure). Overrides: none. No `HARD` rule,
  encryption/auth/schema/dependency change. All edits behavior-preserving.

## Solution shape

- **`src/features/assets/components/investment-allocation.tsx`** — delete the
  local `loadAllocations`/`saveAllocations` (duplicate of `lib/utils/local-store`
  `loadLocal`/`saveLocal`, and `saveAllocations` even lacks the SSR/try-catch
  guard); use `loadLocal(STORAGE_KEY, {})` / `saveLocal(STORAGE_KEY, ...)`.
- **`src/app/dashboard/(overview)/dashboard-overview.tsx`** &
  **`src/app/dashboard/assets/page.tsx`** — replace the hardcoded
  `/dashboard/entry` href with `PAGE_ROUTES.ENTRY`.
- **`src/lib/action-guard.ts`** — drop `export` on `getDekOrThrow` (only used in
  this file; `requireActionContext`/`requireDbContext` are the public surface).
- **`src/lib/constants/supabase-env.ts`** (new) — `getSupabaseEnv()` returning
  `{ url, key }` from the literal `process.env.NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (literal refs preserve Next build-time
  inlining for the browser client), throwing a clear error if either is missing
  instead of masking with `!`. Adopt in `integrations/clients/supabase.ts`,
  `integrations/services/supabase.ts`, and `proxy.ts`.
- **`src/features/expenses/actions/expense-actions.ts`** — give each
  `throwIfSupabaseError` an accurate context label (delete / settle / settle
  month / people read) instead of four reused `'expense write'` (one is a read).
  Server-log only; improves diagnosability.
- **`test/lib/errors/supabase-error.test.ts`** (new) — cover
  `throwIfSupabaseError`: no-op on null/undefined; throws opaque
  `AppError('DB_ERROR', '<context> failed')` carrying no raw message.

## Out of scope

- `deriveKeyFromPinV2` (keystore.ts) — documented-reserved for the rekey-on-unlock
  migration + listed in AGENTS.md key-files (owner-governance edit); kept.
- Sharing `SortDir`/toggle across the two sortable tables (YAGNI until a third).
- The `snapshot-form` effect-deps eslint-disable (minor stylistic inconsistency).
- Any behavior, layout, or data change.

## Acceptance

- [ ] `pnpm check` green (format + lint + typecheck)
- [ ] `pnpm test:ci` green; new `supabase-error` test covers null no-op + opaque
      throw
- [ ] `pnpm build` green (Supabase browser client still resolves its env —
      build-time inlining preserved)
- [ ] No `/dashboard/entry` string literal in the two pages; no
      `NEXT_PUBLIC_SUPABASE_*!` non-null assertions remain; `getDekOrThrow` no
      longer exported (grep)
- [ ] Spec hash matches at impl time

## Risk & reversibility

- **Blast radius**: localStorage prefs, two hrefs, env access, log labels, one
  new test. No data/auth/crypto behavior change. The env helper is the only
  cross-cutting edit (3 files) — guarded by the build gate.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
