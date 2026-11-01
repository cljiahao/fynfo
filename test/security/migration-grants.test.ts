import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const CREATE_RE =
  /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?"?(?:public"?\."?)?(household_[a-z_]+)(?![a-z_])/i;
const GRANT_RE =
  /^\s*grant\s[\s\S]*?\son\s+(?:table\s+)?([\s\S]+?)\s+to\s+([\s\S]+)$/i;
const TABLE_RE = /"?(?:public"?\."?)?(household_[a-z_]+)"?\s*$/i;

// Comments are stripped and the file split on ';' so each statement parses alone.
function statements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .flatMap((f) => statements(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')));
}

function createdHouseholdTables(stmts: string[]): string[] {
  return stmts.flatMap((s) => {
    const m = CREATE_RE.exec(s);
    return m ? [m[1].toLowerCase()] : [];
  });
}

function grantedToAuthenticated(stmts: string[]): Set<string> {
  const granted = new Set<string>();
  for (const s of stmts) {
    const m = GRANT_RE.exec(s);
    if (!m || !/\bauthenticated\b/i.test(m[2])) continue;
    for (const part of m[1].split(',')) {
      const t = TABLE_RE.exec(part.trim());
      if (t) granted.add(t[1].toLowerCase());
    }
  }
  return granted;
}

describe('household table grants', () => {
  const stmts = readStatements();

  it('finds household tables to check', () => {
    expect(createdHouseholdTables(stmts).length).toBeGreaterThan(0);
  });

  it('grants every household_* table to authenticated', () => {
    const granted = grantedToAuthenticated(stmts);
    const missing = [...new Set(createdHouseholdTables(stmts))].filter(
      (t) => !granted.has(t)
    );
    expect(missing).toEqual([]);
  });
});
