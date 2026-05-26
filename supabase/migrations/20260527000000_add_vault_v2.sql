-- Adds v2 vault canary + version + rekey RPC.
-- Idempotent — safe to re-run.
-- Tracked by spec specs/security/001-pbkdf2-rekey.md.

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS vault_check_v2 text,
  ADD COLUMN IF NOT EXISTS vault_version smallint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.rekey_user_data(
  p_user_id            uuid,
  p_vault_check_v2     text,
  p_equity_trades      jsonb,
  p_expense_records    jsonb,
  p_expense_splits     jsonb,
  p_salary_records     jsonb,
  p_asset_entries      jsonb,
  p_tax_relief_entries jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized rekey attempt';
  END IF;

  UPDATE public.equity_trades AS t
    SET ticker = u.ticker, shares = u.shares, price = u.price, fees = u.fees
    FROM jsonb_to_recordset(p_equity_trades)
      AS u(id uuid, ticker text, shares text, price text, fees text)
    WHERE t.id = u.id AND t.user_id = p_user_id;

  UPDATE public.expense_records AS t
    SET item = u.item, info = u.info, amount = u.amount
    FROM jsonb_to_recordset(p_expense_records)
      AS u(id uuid, item text, info text, amount text)
    WHERE t.id = u.id AND t.user_id = p_user_id;

  UPDATE public.expense_splits AS t
    SET amount = u.amount
    FROM jsonb_to_recordset(p_expense_splits)
      AS u(id uuid, amount text)
    WHERE t.id = u.id
      AND EXISTS (
        SELECT 1 FROM public.expense_records er
        WHERE er.id = t.expense_id AND er.user_id = p_user_id
      );

  UPDATE public.salary_records AS t
    SET salary = u.salary, bonus = u.bonus
    FROM jsonb_to_recordset(p_salary_records)
      AS u(id uuid, salary text, bonus text)
    WHERE t.id = u.id AND t.user_id = p_user_id;

  UPDATE public.asset_entries AS t
    SET account = u.account, amount = u.amount
    FROM jsonb_to_recordset(p_asset_entries)
      AS u(id uuid, account text, amount text)
    WHERE t.id = u.id
      AND EXISTS (
        SELECT 1 FROM public.monthly_snapshots ms
        WHERE ms.id = t.snapshot_id AND ms.user_id = p_user_id
      );

  UPDATE public.tax_relief_entries AS t
    SET amount = u.amount
    FROM jsonb_to_recordset(p_tax_relief_entries)
      AS u(id uuid, amount text)
    WHERE t.id = u.id AND t.user_id = p_user_id;

  UPDATE public.users_profile
    SET vault_check_v2 = p_vault_check_v2,
        vault_check    = NULL,
        vault_version  = 2
    WHERE id = p_user_id AND vault_version = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'users_profile row not in v1 state for %', p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rekey_user_data(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rekey_user_data(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
