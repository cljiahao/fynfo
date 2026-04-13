/**
 * Migration script: Local Postgres (Prisma/NextAuth) → Supabase
 *
 * Usage:
 *   pnpm tsx scripts/migrate-local-to-supabase.ts
 *
 * Required env vars (can be set in .env.local or inline):
 *   LOCAL_DATABASE_URL   — postgres connection string to local DB
 *   SUPABASE_SERVICE_KEY — service role key (bypasses RLS), from Supabase Dashboard → Settings → API
 *   NEXT_PUBLIC_SUPABASE_URL
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { Pool } from 'pg';
import * as readline from 'readline';
import { encryptPayload } from '../src/lib/crypto';
import { deriveKeyFromPin } from '../src/lib/keystore';

config({ path: '.env.local' });
config({ path: '.env', override: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function enc(
  value: string | number | null | undefined,
  dek: Buffer
): Promise<string> {
  if (value === null || value === undefined || value === '') return '';
  return encryptPayload(String(value), dek);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function migrate(email: string, supabaseUserId: string, dek: Buffer) {
  const localDbUrl = process.env.LOCAL_DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!localDbUrl) throw new Error('LOCAL_DATABASE_URL is not set');
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_KEY is not set');

  const pool = new Pool({ connectionString: localDbUrl });
  // Service role key bypasses RLS so we can insert on behalf of any user
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Look up old user ────────────────────────────────────────────────────────
  const {
    rows: [oldUser],
  } = await pool.query(
    'SELECT id, name, email, image FROM "User" WHERE email = $1',
    [email]
  );
  if (!oldUser)
    throw new Error(`No user found with email ${email} in local DB`);
  console.log(
    `\nFound local user: ${oldUser.name ?? oldUser.email} (${oldUser.id})`
  );

  // ── users_profile ───────────────────────────────────────────────────────────
  const {
    rows: [profile],
  } = await pool.query('SELECT * FROM "UserProfile" WHERE "userId" = $1', [
    oldUser.id,
  ]);

  await supabase.from('users_profile').upsert({
    id: supabaseUserId,
    name: oldUser.name ?? null,
    email: oldUser.email,
    image: oldUser.image ?? null,
    birth_year: profile?.birthYear ?? null,
    is_nsman: profile?.isNsman ?? false,
    residency_status: profile?.residencyStatus ?? 'resident',
  });
  console.log('✓ users_profile');

  // ── planner_settings ────────────────────────────────────────────────────────
  const {
    rows: [planner],
  } = await pool.query('SELECT * FROM "PlannerSettings" WHERE "userId" = $1', [
    oldUser.id,
  ]);
  if (planner) {
    await supabase.from('planner_settings').upsert({
      id: randomUUID(),
      user_id: supabaseUserId,
      emergency_months: planner.emergencyMonths,
      war_chest_months: planner.warChestMonths,
      tithe_enabled: planner.titheEnabled,
      tithe_pct: planner.tithePct,
      allowance_enabled: planner.allowanceEnabled,
      allowance_pct: planner.allowancePct,
    });
    console.log('✓ planner_settings');
  }

  // ── tax_relief_entries ──────────────────────────────────────────────────────
  const { rows: reliefs } = await pool.query(
    'SELECT * FROM "TaxReliefEntry" WHERE "userId" = $1',
    [oldUser.id]
  );
  for (const r of reliefs) {
    await supabase.from('tax_relief_entries').upsert({
      id: randomUUID(),
      user_id: supabaseUserId,
      year: r.year,
      relief_key: r.reliefKey,
      amount: await enc(r.amount, dek),
    });
  }
  console.log(`✓ tax_relief_entries (${reliefs.length} rows)`);

  // ── monthly_snapshots + asset_entries ──────────────────────────────────────
  const { rows: snapshots } = await pool.query(
    'SELECT * FROM "MonthlySnapshot" WHERE "userId" = $1 ORDER BY month',
    [oldUser.id]
  );
  for (const snap of snapshots) {
    const newSnapId = randomUUID();
    await supabase.from('monthly_snapshots').upsert({
      id: newSnapId,
      month: snap.month,
      user_id: supabaseUserId,
    });

    const { rows: entries } = await pool.query(
      'SELECT * FROM "AssetEntry" WHERE "snapshotId" = $1',
      [snap.id]
    );
    for (const e of entries) {
      await supabase.from('asset_entries').insert({
        id: randomUUID(),
        snapshot_id: newSnapId,
        category: e.category,
        account: await enc(e.account, dek),
        amount: await enc(e.amount, dek),
      });
    }
  }
  console.log(`✓ monthly_snapshots (${snapshots.length}) + asset_entries`);

  // ── salary_records ──────────────────────────────────────────────────────────
  const { rows: salaries } = await pool.query(
    'SELECT * FROM "SalaryRecord" WHERE "userId" = $1',
    [oldUser.id]
  );
  for (const s of salaries) {
    await supabase.from('salary_records').upsert({
      id: randomUUID(),
      user_id: supabaseUserId,
      month: s.month,
      salary: await enc(s.salary, dek),
      bonus: await enc(s.bonus, dek),
    });
  }
  console.log(`✓ salary_records (${salaries.length} rows)`);

  // ── equity_trades ───────────────────────────────────────────────────────────
  const { rows: trades } = await pool.query(
    'SELECT * FROM "EquityTrade" WHERE "userId" = $1',
    [oldUser.id]
  );
  for (const t of trades) {
    await supabase.from('equity_trades').insert({
      id: randomUUID(),
      user_id: supabaseUserId,
      date: t.date,
      broker: t.broker,
      action: t.action,
      ticker: await enc(t.ticker, dek),
      shares: await enc(t.shares, dek),
      price: await enc(t.price, dek),
      fees: await enc(t.fees, dek),
    });
  }
  console.log(`✓ equity_trades (${trades.length} rows)`);

  // ── expense_records + splits ─────────────────────────────────────────────────
  const { rows: expenses } = await pool.query(
    'SELECT * FROM "ExpenseRecord" WHERE "userId" = $1 ORDER BY date',
    [oldUser.id]
  );
  for (const ex of expenses) {
    const newExpId = randomUUID();
    await supabase.from('expense_records').upsert({
      id: newExpId,
      user_id: supabaseUserId,
      date: ex.date,
      type: ex.type,
      item: await enc(ex.item, dek),
      info: await enc(ex.info, dek),
      amount: await enc(ex.amount, dek),
      split_type: ex.splitType,
    });

    const { rows: splits } = await pool.query(
      'SELECT * FROM "ExpenseSplit" WHERE "expenseId" = $1',
      [ex.id]
    );
    for (const sp of splits) {
      await supabase.from('expense_splits').insert({
        id: randomUUID(),
        expense_id: newExpId,
        person: sp.person,
        amount: await enc(sp.amount, dek),
        settled: sp.settled,
      });
    }
  }
  console.log(`✓ expense_records (${expenses.length}) + splits`);

  await pool.end();
  console.log(`\n✅ Migration complete for ${email}\n`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Fynfo: Local → Supabase Migration ===\n');

  const email = await prompt('Email address (as in local DB): ');
  const supabaseUserId = await prompt(
    'Supabase user UUID (from Auth → Users dashboard): '
  );
  const pin = await prompt('Vault PIN for this user: ');

  const dek = deriveKeyFromPin(pin);
  await migrate(email, supabaseUserId, dek);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
