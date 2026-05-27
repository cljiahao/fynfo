---
id: 006
slug: post-rekey-cleanup
area: fix
status: approved
author: clarence + claude (opus 4.7, 2026-05-28)
created: 2026-05-28
approved: 2026-05-28
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§Simplicity' # remove dead code immediately once a one-shot migration is complete
  - '§Security' # smaller attack surface — fewer key derivations, fewer diagnostic endpoints
constitution_overrides:
---

# Spec 006: Post-rekey cleanup — remove v1 / probe / backup tooling

## Problem

All `users_profile` rows now have `vault_version = 2`, `vault_check IS NULL`, `vault_check_v2 IS NOT NULL` (verified manually). The v1→v2 migration path, the salvage probe endpoint, and the rekey backup tooling have served their purpose. Leaving them in the tree means:

- Live attack surface: `/api/vault/probe` is an authenticated endpoint that publishes per-cell key matches (v1 / intermediate / v2 / none) and was always marked TEMPORARY. Keeping it shipped is a self-inflicted leak.
- Dead code drift: `deriveKeyFromPin`, `deriveKeyClient`, `deriveKeyClientIntermediate`, `V1_*` + `INTERMEDIATE_*` constants, `rekeyUserVault`, and `ENCRYPTED_TABLES` manifest are reachable only from probe + Case B of `/api/vault`. Future readers waste time understanding crypto paths no caller exercises.
- Stale db object: `rekey_user_data` Postgres function has no client. Free attack surface inside Supabase.
- Stale scripts: `scripts/backup-*` were rekey insurance. Both users complete → tooling no longer matched to any active risk. Re-add fresh from a future spec when needed.

## Constitution check

- Satisfies: simpler code, smaller attack surface, no dead crypto paths.
- Overrides: none.

## Solution shape

### Code deletions

- `src/app/api/vault/probe/route.ts` — entire route deleted.
- `src/lib/vault-rekey/rekey.ts` + `src/lib/vault-rekey/manifest.ts` + the `vault-rekey/` dir.
- `scripts/backup-to-supabase.sh`, `scripts/backup-to-supabase.ps1`, `scripts/backup-via-sql-editor.sql`, `scripts/README.md`, and the `scripts/` dir if no other files remain.

### Code edits

- `src/app/api/vault/route.ts`
  - Drop the import of `rekeyUserVault`.
  - `VaultUnlockSchema` shrinks to `{ derivedKey: base64Dek }` (single key).
  - Remove Case B (v1 vault rekey). Keep only Case A (v2 canary verify) and Case C (first unlock writes v2 canary).
  - `getUser()` already in place — unchanged.
  - The legacy `vault_check` column is no longer read; remove from `.select('vault_check, vault_check_v2, vault_version')` so the query is `.select('vault_check_v2')`.
- `src/lib/keystore.ts` — delete `deriveKeyFromPin` (v1). Keep `deriveKeyFromPinV2`, `getSessionSecret`, `getVaultDekSession`.
- `src/lib/client-crypto.ts` — delete `deriveKeyClient` (v1) and `deriveKeyClientIntermediate`. Keep `deriveKeyClientV2`.
- `src/lib/crypto-constants.ts` — delete `V1_PBKDF2_SALT`, `V1_ITERATIONS`, `INTERMEDIATE_PBKDF2_SALT_PREFIX`, `INTERMEDIATE_ITERATIONS`. Keep `V2_ITERATIONS`, `KEY_LEN_BYTES`, `PBKDF2_DIGEST`.
- `src/features/auth/components/vault-unlock-flow.tsx` — replace dual derivation with a single `deriveKeyClientV2` call. `DerivedKeys` type collapses to `{ derivedKey: string }`; POST body matches new schema.
- `src/lib/logger.ts` — drop `vault_check` from the PII redact list (no longer logged).
- `test/api/vault.test.ts` — drop Case B (v1→v2 rekey) tests. Keep Case A (v2 unlock), Case C (first unlock), invalid input, unauthorised, wrong-PIN canary rejection.

### Database

- New migration `supabase/migrations/20260528010000_drop_rekey_rpc.sql`:
  - `DROP FUNCTION IF EXISTS public.rekey_user_data(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);`
- `users_profile.vault_check` and `users_profile.vault_version` columns intentionally NOT dropped this PR. Column drop is destructive per `CONSTITUTION.md` §0 and the columns are harmless `NULL` cruft. Future spec may drop them once we have a second confirmation pass.

### Manual steps (you, after merge)

1. Apply the new migration in Supabase Studio → SQL Editor → paste `supabase/migrations/20260528010000_drop_rekey_rpc.sql` → Run. Expect "Success. No rows returned."
2. Verify the RPC is gone: `SELECT proname FROM pg_proc WHERE proname = 'rekey_user_data';` returns 0 rows.
3. Delete the `fynfo-backup` Supabase project (Studio → Project Settings → Danger Zone → Delete project). Confirms with project name.

## Out of scope

- Dropping `users_profile.vault_check` / `vault_version` columns. Deferred.
- Refactoring crypto-constants into a smaller single-purpose file.
- Touching the rekey migration files (`20260527000000_add_vault_v2.sql`, `20260528000000_fix_rekey_id_text.sql`). They stay as historical migration trail.

## Acceptance

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [ ] No string `rekeyUserVault`, `deriveKeyFromPin`, `deriveKeyClient\b`, `deriveKeyClientIntermediate`, `V1_`, `INTERMEDIATE_`, `/api/vault/probe`, `vault-rekey`, or `vault_check\b` (excluding `vault_check_v2`) in `src/**` or `test/**`.
- [ ] `src/app/api/vault/probe/`, `src/lib/vault-rekey/`, `scripts/` directories absent.
- [ ] Vault unlock works end-to-end for both v2 users — manual smoke.
- [ ] After migration applied: `rekey_user_data` function absent from pg_proc.

## Risk & reversibility

- **Blast radius**: high if any user still on v1 — they would be permanently locked out because there is no rekey path left. Pre-flight check (both users `vault_version = 2`) confirms zero v1 users.
- **Reversibility**: `git revert` restores all code. The dropped RPC is recreated via re-running migration `20260528000000_fix_rekey_id_text.sql`. Supabase backup project deletion is NOT reversible — manual recreation only.
- **Backout plan**: if a v1 vault surfaces post-deploy (impossible given pre-flight), `git revert` the impl commit and re-apply the RPC migration. The user re-unlocks → rekeys.

## Open questions

- [ ] Should the spec 001 / 002 / 004 / 005 specs flip from `status: approved` / `status: shipped` to `status: superseded`? They aren't superseded — they shipped — leave as-is. Spec 001 should set `status: shipped` since rekey is complete; do that in a follow-up tidy commit, not here.
