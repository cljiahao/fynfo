-- fynfo - Initialize Supabase Schema
-- This script replaces the old Prisma schema with native PostgreSQL DDL and Row Level Security (RLS) policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Profile (Extending auth.users)
-- We use auth.users as the primary identity provider in Supabase Auth.
CREATE TABLE "public"."users_profile" (
  "id" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "name" TEXT,
  "email" TEXT UNIQUE NOT NULL,
  "image" TEXT,
  "birth_year" INTEGER,
  "is_nsman" BOOLEAN DEFAULT false,
  "residency_status" TEXT DEFAULT 'resident',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Planner Settings
CREATE TABLE "public"."planner_settings" (
  "id" TEXT PRIMARY KEY,
  "user_id" UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "emergency_months" INTEGER DEFAULT 3,
  "war_chest_months" INTEGER DEFAULT 9,
  "tithe_enabled" BOOLEAN DEFAULT true,
  "tithe_pct" INTEGER DEFAULT 10,
  "allowance_enabled" BOOLEAN DEFAULT false,
  "allowance_pct" INTEGER DEFAULT 5,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tax Relief Entry
CREATE TABLE "public"."tax_relief_entries" (
  "id" TEXT PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "year" INTEGER NOT NULL,
  "relief_key" TEXT NOT NULL,
  "amount" TEXT NOT NULL,     -- Changed to TEXT to support encryption!
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE("user_id", "year", "relief_key")
);
CREATE INDEX idx_tax_relief_user_year ON tax_relief_entries(user_id, year);

-- 4. Expense Record
CREATE TABLE "public"."expense_records" (
  "id" TEXT PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "date" TIMESTAMP WITH TIME ZONE NOT NULL,
  "type" TEXT NOT NULL,
  "item" TEXT DEFAULT '', -- Will be encrypted
  "info" TEXT DEFAULT '', -- Will be encrypted
  "amount" TEXT NOT NULL, -- Stored as TEXT because it will be AES-GCM encrypted
  "split_type" TEXT DEFAULT 'self',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_expense_records_user ON expense_records(user_id);
CREATE INDEX idx_expense_records_date ON expense_records(date);

-- 5. Expense Split
CREATE TABLE "public"."expense_splits" (
  "id" TEXT PRIMARY KEY,
  "expense_id" TEXT NOT NULL REFERENCES expense_records(id) ON DELETE CASCADE,
  "person" TEXT NOT NULL, -- Encrypted? If privacy dictates, make it TEXT encrypted
  "amount" TEXT NOT NULL, -- Encrypted
  "settled" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);

-- 6. Monthly Snapshot
CREATE TABLE "public"."monthly_snapshots" (
  "id" TEXT PRIMARY KEY,
  "month" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE("user_id", "month")
);
CREATE INDEX idx_monthly_snapshots_user ON monthly_snapshots(user_id);

-- 7. Asset Entry
CREATE TABLE "public"."asset_entries" (
  "id" TEXT PRIMARY KEY,
  "snapshot_id" TEXT NOT NULL REFERENCES monthly_snapshots(id) ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "account" TEXT DEFAULT '', -- Encrypted
  "amount" TEXT NOT NULL,    -- Encrypted
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_asset_entries_snapshot ON asset_entries(snapshot_id);

-- 8. Salary Record
CREATE TABLE "public"."salary_records" (
  "id" TEXT PRIMARY KEY,
  "month" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "salary" TEXT NOT NULL, -- Encrypted
  "bonus" TEXT DEFAULT '0', -- Encrypted
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE("user_id", "month")
);
CREATE INDEX idx_salary_records_user ON salary_records(user_id);

-- 9. Equity Trade
CREATE TABLE "public"."equity_trades" (
  "id" TEXT PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "date" TIMESTAMP WITH TIME ZONE NOT NULL,
  "broker" TEXT NOT NULL,
  "ticker" TEXT NOT NULL,   -- Encrypted
  "action" TEXT NOT NULL,
  "shares" TEXT NOT NULL,   -- Encrypted
  "price" TEXT NOT NULL,    -- Encrypted
  "fees" TEXT DEFAULT '0',  -- Encrypted
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_equity_trades_user ON equity_trades(user_id);


-----------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-----------------------------------------

-- 1. users_profile
ALTER TABLE "public"."users_profile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON "public"."users_profile" FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON "public"."users_profile" FOR UPDATE USING (auth.uid() = id);

-- 2. planner_settings
ALTER TABLE "public"."planner_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON "public"."planner_settings" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON "public"."planner_settings" FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON "public"."planner_settings" FOR UPDATE USING (auth.uid() = user_id);

-- 3. tax_relief_entries
ALTER TABLE "public"."tax_relief_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tax reliefs" ON "public"."tax_relief_entries" FOR ALL USING (auth.uid() = user_id);

-- 4. expense_records
ALTER TABLE "public"."expense_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON "public"."expense_records" FOR ALL USING (auth.uid() = user_id);

-- 5. expense_splits
ALTER TABLE "public"."expense_splits" ENABLE ROW LEVEL SECURITY;
-- We join back to the expense_records table to enforce RLS
CREATE POLICY "Users manage splits through expense record" ON "public"."expense_splits" 
FOR ALL USING (
    EXISTS (SELECT 1 FROM expense_records WHERE expense_records.id = expense_splits.expense_id AND expense_records.user_id = auth.uid())
);

-- 6. monthly_snapshots
ALTER TABLE "public"."monthly_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots" ON "public"."monthly_snapshots" FOR ALL USING (auth.uid() = user_id);

-- 7. asset_entries
ALTER TABLE "public"."asset_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage asset entries through snapshot" ON "public"."asset_entries"
FOR ALL USING (
    EXISTS (SELECT 1 FROM monthly_snapshots WHERE monthly_snapshots.id = asset_entries.snapshot_id AND monthly_snapshots.user_id = auth.uid())
);

-- 8. salary_records
ALTER TABLE "public"."salary_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own salaries" ON "public"."salary_records" FOR ALL USING (auth.uid() = user_id);

-- 9. equity_trades
ALTER TABLE "public"."equity_trades" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own equity trades" ON "public"."equity_trades" FOR ALL USING (auth.uid() = user_id);
