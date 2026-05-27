-- Drops the v1->v2 rekey RPC. No code path still calls it after spec 006
-- post-rekey cleanup; both production users are at vault_version = 2.
-- Tracked by spec specs/fix/006-post-rekey-cleanup.md.

DROP FUNCTION IF EXISTS public.rekey_user_data(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
);
