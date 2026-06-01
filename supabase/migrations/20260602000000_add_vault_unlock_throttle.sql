-- Vault unlock rate-limit / lockout (audit HIGH #1).
-- Policy: 5 failed unlocks per 15-min window -> lock for 15 min; reset on success.
-- Idempotent — safe to re-run.
-- Tracked by spec specs/security/003-vault-unlock-rate-limit.md.

-- Counter table. RLS is enabled with NO policies, so the user's session cannot
-- read or write it directly (default-deny). The SECURITY DEFINER functions below
-- are the only access path — this makes the counter tamper-proof even though the
-- app uses the user's RLS-scoped session (no service-role key in this stack).
CREATE TABLE IF NOT EXISTS public.vault_unlock_attempts (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fail_count   smallint NOT NULL DEFAULT 0,
  window_start timestamptz,
  locked_until timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_unlock_attempts ENABLE ROW LEVEL SECURITY;

-- Returns true iff the caller's vault unlock is currently locked.
CREATE OR REPLACE FUNCTION public.vault_unlock_locked()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_until timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT locked_until INTO v_locked_until
    FROM public.vault_unlock_attempts
    WHERE user_id = auth.uid();

  RETURN v_locked_until IS NOT NULL AND v_locked_until > now();
END;
$$;

-- Records an unlock attempt. On success: reset. On failure: increment within a
-- 15-min window (or start a fresh window), and lock for 15 min once 5 failures
-- accumulate. Returns true iff the vault is now locked.
CREATE OR REPLACE FUNCTION public.vault_unlock_record(p_success boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_row      public.vault_unlock_attempts%ROWTYPE;
  v_window   constant interval := interval '15 minutes';
  v_lockfor  constant interval := interval '15 minutes';
  v_max      constant smallint := 5;
  v_next     smallint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_row
    FROM public.vault_unlock_attempts
    WHERE user_id = v_uid
    FOR UPDATE;

  IF p_success THEN
    INSERT INTO public.vault_unlock_attempts (user_id, fail_count, window_start, locked_until, updated_at)
      VALUES (v_uid, 0, NULL, NULL, now())
      ON CONFLICT (user_id) DO UPDATE
        SET fail_count = 0, window_start = NULL, locked_until = NULL, updated_at = now();
    RETURN false;
  END IF;

  -- Failure, no prior row -> first failure starts a window.
  IF v_row.user_id IS NULL THEN
    INSERT INTO public.vault_unlock_attempts (user_id, fail_count, window_start, updated_at)
      VALUES (v_uid, 1, now(), now());
    RETURN false;
  END IF;

  -- Window expired (or never started) -> start a fresh window at 1.
  IF v_row.window_start IS NULL OR now() - v_row.window_start > v_window THEN
    UPDATE public.vault_unlock_attempts
      SET fail_count = 1, window_start = now(), locked_until = NULL, updated_at = now()
      WHERE user_id = v_uid;
    RETURN false;
  END IF;

  -- Within the window -> increment, lock once the threshold is reached.
  v_next := v_row.fail_count + 1;
  UPDATE public.vault_unlock_attempts
    SET fail_count = v_next,
        locked_until = CASE WHEN v_next >= v_max THEN now() + v_lockfor ELSE locked_until END,
        updated_at = now()
    WHERE user_id = v_uid;

  RETURN v_next >= v_max;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_unlock_locked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_unlock_locked() TO authenticated;

REVOKE ALL ON FUNCTION public.vault_unlock_record(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_unlock_record(boolean) TO authenticated;
