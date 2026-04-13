-- Add vault_check column to users_profile for PIN verification.
-- Stores a known plaintext ("fynfo_vault_ok") encrypted with the user's DEK.
-- Used to verify the correct PIN was entered without storing the PIN itself.
ALTER TABLE "public"."users_profile"
  ADD COLUMN IF NOT EXISTS "vault_check" TEXT;
