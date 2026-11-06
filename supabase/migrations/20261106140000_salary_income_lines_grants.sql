-- Without a table grant, PostgREST answers 403 for authenticated users even though RLS policies exist.
GRANT SELECT, INSERT, DELETE ON TABLE public.salary_income_lines TO authenticated;
