-- Add INSERT policy for users_profile.
-- The vault API upserts a profile row on first PIN entry (to store vault_check).
-- Without this policy, the upsert silently fails under RLS with the anon key.
CREATE POLICY "Users can insert own profile"
  ON "public"."users_profile"
  FOR INSERT
  WITH CHECK (auth.uid() = id);
