-- Spec071: trusted online unlock accounting and telemetry boundaries.
BEGIN;

CREATE TABLE public.vault_unlock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX vault_unlock_reservations_user ON public.vault_unlock_reservations(user_id);
ALTER TABLE public.vault_unlock_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_unlock_reservations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.vault_unlock_attempts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.vault_unlock_record(boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.vault_unlock_locked() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.reserve_vault_unlock(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row public.vault_unlock_attempts%ROWTYPE;
  v_expired integer;
  v_pending integer;
  v_token uuid;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid attempt'; END IF;
  INSERT INTO public.vault_unlock_attempts(user_id) VALUES(p_user_id)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.vault_unlock_attempts
    WHERE user_id = p_user_id FOR UPDATE;
  IF v_row.locked_until > clock_timestamp() THEN RETURN NULL; END IF;

  IF v_row.window_start IS NULL OR v_row.window_start + interval '15 minutes' <= clock_timestamp() THEN
    v_row.fail_count := 0;
    v_row.window_start := clock_timestamp();
    v_row.locked_until := NULL;
    DELETE FROM public.vault_unlock_reservations
      WHERE user_id = p_user_id AND expires_at <= clock_timestamp();
  END IF;
  WITH expired AS (
    DELETE FROM public.vault_unlock_reservations
      WHERE user_id = p_user_id AND expires_at <= clock_timestamp()
      RETURNING id
  ) SELECT count(*) INTO v_expired FROM expired;
  v_row.fail_count := least(5, v_row.fail_count + v_expired);
  IF v_row.fail_count >= 5 THEN v_row.locked_until := clock_timestamp() + interval '15 minutes'; END IF;
  UPDATE public.vault_unlock_attempts
    SET fail_count = v_row.fail_count, window_start = v_row.window_start,
        locked_until = v_row.locked_until, updated_at = clock_timestamp()
    WHERE user_id = p_user_id;
  SELECT count(*) INTO v_pending FROM public.vault_unlock_reservations WHERE user_id = p_user_id;
  IF v_row.fail_count + v_pending >= 5 THEN RETURN NULL; END IF;
  INSERT INTO public.vault_unlock_reservations(user_id, expires_at)
    VALUES(p_user_id, clock_timestamp() + interval '60 seconds') RETURNING id INTO v_token;
  RETURN v_token;
END;
$$;

CREATE FUNCTION public.finish_vault_unlock(p_user_id uuid, p_attempt_id uuid, p_success boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row public.vault_unlock_attempts%ROWTYPE;
  v_attempt public.vault_unlock_reservations%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_success IS NULL THEN
    RAISE EXCEPTION 'invalid attempt';
  END IF;
  SELECT * INTO v_row FROM public.vault_unlock_attempts WHERE user_id = p_user_id FOR UPDATE;
  SELECT * INTO v_attempt FROM public.vault_unlock_reservations
    WHERE id = p_attempt_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'invalid attempt'; END IF;
  DELETE FROM public.vault_unlock_reservations WHERE id = v_attempt.id;
  IF p_success THEN
    UPDATE public.vault_unlock_attempts
      SET fail_count = 0, window_start = clock_timestamp(), locked_until = NULL, updated_at = clock_timestamp()
      WHERE user_id = p_user_id;
    RETURN false;
  END IF;
  IF v_row.window_start + interval '15 minutes' <= clock_timestamp() THEN
    v_row.fail_count := 0;
    v_row.window_start := clock_timestamp();
    v_row.locked_until := NULL;
  END IF;
  v_row.fail_count := least(5, v_row.fail_count + 1);
  IF v_row.fail_count >= 5 THEN v_row.locked_until := clock_timestamp() + interval '15 minutes'; END IF;
  UPDATE public.vault_unlock_attempts
    SET fail_count = v_row.fail_count, window_start = v_row.window_start,
        locked_until = v_row.locked_until, updated_at = clock_timestamp()
    WHERE user_id = p_user_id;
  RETURN v_row.fail_count >= 5;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_vault_unlock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_vault_unlock(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_vault_unlock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_vault_unlock(uuid, uuid, boolean) TO service_role;

REVOKE ALL ON public.marketing_events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_marketing_event_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_signup_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_event_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_signup_stats() TO service_role;
ALTER FUNCTION public.get_marketing_event_stats() SET search_path = '';
ALTER FUNCTION public.get_signup_stats() SET search_path = '';

CREATE FUNCTION public.record_marketing_event(p_event_type text, p_path text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_event_type IS NULL OR p_event_type NOT IN ('page_view', 'cta_click')
    OR p_path IS NULL OR p_path NOT IN ('/', '/login') THEN
    RAISE EXCEPTION 'invalid event';
  END IF;
  INSERT INTO public.marketing_events(event_type, path) VALUES(p_event_type, p_path);
END;
$$;
REVOKE ALL ON FUNCTION public.record_marketing_event(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketing_event(text, text) TO service_role;

COMMIT;
