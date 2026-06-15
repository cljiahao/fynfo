------------------------------------------
-- equity_dividends (spec 039)
-- Distribution / dividend income per holding. ticker + amount are
-- AES-256-GCM encrypted (zero-knowledge, §2.1); currency + date are
-- plaintext metadata, mirroring equity_trades.
------------------------------------------

CREATE TABLE "public"."equity_dividends" (
  "id" TEXT PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "ticker" TEXT NOT NULL,            -- Encrypted
  "amount" TEXT NOT NULL,            -- Encrypted (native-currency amount received)
  "currency" TEXT NOT NULL DEFAULT 'SGD',
  "date" DATE NOT NULL,              -- payment date
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_equity_dividends_user ON equity_dividends(user_id);

ALTER TABLE "public"."equity_dividends" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own equity dividends" ON "public"."equity_dividends" FOR ALL USING (auth.uid() = user_id);

-- API role privileges. GRANT is checked BEFORE RLS, so without this the
-- `authenticated` role hits "42501 permission denied for table" on every read
-- and write — RLS never even runs. RLS still gates which rows are visible.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."equity_dividends" TO authenticated;
