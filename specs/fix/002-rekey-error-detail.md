---
id: 002
slug: rekey-error-detail
area: fix
status: shipped
author: claude (opus 4.7, 2026-05-27)
created: 2026-05-27
approved: 2026-05-27
shipped: 2026-05-27
impl_pr: https://github.com/cljiahao/fynfo/commit/15d3169
supersedes:
constitution_satisfies:
  - '§Observability' # structured logs at every error boundary
  - '§Security' # error messages MUST NOT leak DB schema to clients
constitution_overrides:
---

# Spec 002: Surface supabase error detail in vault rekey

## Problem

`/api/vault` returns 500 during the v1→v2 rekey path with the opaque server log:

```
{"label":"api.vault.unlock","code":"DB_ERROR","msg":"vault rekey: read expense_splits failed"}
```

The supabase client returned an error object with `code`, `message`, `details`, `hint` — all dropped on the floor by `fetchRows` in `src/lib/vault-rekey/rekey.ts`. Root cause of the failure (RLS denial vs schema-cache miss vs timeout vs PostgREST URL overflow) is undiagnosable without these fields.

The user-facing 500 stays opaque (handled by `handleApiError`); only the server log gains detail.

## Constitution check

- Satisfies: structured logging at error boundaries; zero client-visible schema leak.
- Overrides: none.

## Solution shape

- `src/lib/vault-rekey/rekey.ts`: in both `fetchRows` error branches (direct-owned + joinVia parent + joinVia child), log `error.code`, `error.message`, `error.details`, `error.hint`, plus the `table` and `userId` (already structured) before throwing `AppError('DB_ERROR', ...)`.
- AppError message stays generic (`vault rekey: read <table> failed`) — no schema leak to client.
- Use the existing `logger` from `@/lib/logger` (Pino, PII-redacted).

## Out of scope

- Fixing the underlying expense_splits failure. This spec only adds the diagnostic.
- Touching the v1→v2 rekey RPC or schema.
- Changing the user-facing error response.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] Manual: re-run vault unlock against the failing user; server log now contains `code`/`message`/`details`/`hint` from supabase for the failed table read.
- [ ] No new dependency. No client-facing message changes.

## Risk & reversibility

- **Blast radius**: server log only. Zero behavioural change for successful paths.
- **Reversibility**: single git revert.
- **Backout plan**: revert the commit.

## Open questions

- [ ] None.
