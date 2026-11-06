-- Typed income lines per month. salary_records stays as the legacy/dual-written
-- summary row so a code revert keeps working. Additive only.

CREATE TABLE "public"."salary_income_lines" (
  "id" TEXT PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "month" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('salary', 'bonus', 'one_time')),
  "label" TEXT NOT NULL, -- Encrypted
  "amount" TEXT NOT NULL, -- Encrypted
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_salary_income_lines_user_month
  ON public.salary_income_lines (user_id, month);

ALTER TABLE "public"."salary_income_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own income lines" ON "public"."salary_income_lines"
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Atomic month save. SECURITY INVOKER so RLS applies to every statement; the
-- function never reads or compares encrypted values.
CREATE OR REPLACE FUNCTION public.replace_salary_month(
  p_month text,
  p_lines jsonb,
  p_salary text,
  p_bonus text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid month';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'invalid lines';
  END IF;

  DELETE FROM public.salary_income_lines
  WHERE user_id = v_user AND month = p_month;

  INSERT INTO public.salary_income_lines
    (id, user_id, month, type, label, amount, position)
  SELECT l.id, v_user, p_month, l.type, l.label, l.amount, l.position
  FROM jsonb_to_recordset(p_lines)
    AS l(id text, type text, label text, amount text, position integer);

  INSERT INTO public.salary_records (id, user_id, month, salary, bonus, updated_at)
  VALUES (gen_random_uuid()::text, v_user, p_month, p_salary, p_bonus, now())
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    salary = EXCLUDED.salary,
    bonus = EXCLUDED.bonus,
    updated_at = EXCLUDED.updated_at;
END;
$$;
