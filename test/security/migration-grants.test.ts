import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
// Tables created from this migration timestamp on must be granted explicitly,
// because RLS policies alone do not give the authenticated role table access.
const GRANT_REQUIRED_FROM = '20261101000000';
const CREATE_RE =
  /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?"?(?:public"?\."?)?([a-z_][a-z0-9_]*)"?(?![a-z0-9_])/i;
const GRANT_RE =
  /^\s*grant\s[\s\S]*?\son\s+(?:table\s+)?([\s\S]+?)\s+to\s+([\s\S]+)$/i;
const REVOKE_RE =
  /^\s*revoke\s[\s\S]*?\son\s+(?:table\s+)?([\s\S]+?)\s+from\s+([\s\S]+)$/i;
const TABLE_RE = /"?(?:public"?\."?)?([a-z_][a-z0-9_]*)"?\s*$/i;

// Comments are stripped and the file split on ';' so each statement parses alone.
function statements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function fileStatements(file: string): string[] {
  return statements(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
}

function createdTables(stmts: string[]): string[] {
  return stmts.flatMap((s) => {
    const m = CREATE_RE.exec(s);
    return m ? [m[1].toLowerCase()] : [];
  });
}

function tablesTouchingAuthenticated(stmts: string[], re: RegExp): Set<string> {
  const found = new Set<string>();
  for (const s of stmts) {
    const m = re.exec(s);
    if (!m || !/\bauthenticated\b/i.test(m[2])) continue;
    for (const part of m[1].split(',')) {
      const t = TABLE_RE.exec(part.trim());
      if (t) found.add(t[1].toLowerCase());
    }
  }
  return found;
}

describe('table grants', () => {
  const files = migrationFiles();
  const all = files.flatMap(fileStatements);
  const granted = tablesTouchingAuthenticated(all, GRANT_RE);
  // A deliberate REVOKE from authenticated marks a table reachable only through
  // trusted RPCs, so the absence of a grant is intentional there.
  const closed = tablesTouchingAuthenticated(all, REVOKE_RE);

  it('finds household tables to check', () => {
    expect(
      createdTables(all).filter((t) => t.startsWith('household_')).length
    ).toBeGreaterThan(0);
  });

  it('grants every household_* table to authenticated', () => {
    const missing = [
      ...new Set(createdTables(all).filter((t) => t.startsWith('household_'))),
    ].filter((t) => !granted.has(t));
    expect(missing).toEqual([]);
  });

  it('grants or deliberately closes every table created since the grant requirement', () => {
    const recent = files
      .filter((f) => f.slice(0, 14) >= GRANT_REQUIRED_FROM)
      .flatMap((f) => createdTables(fileStatements(f)));
    expect(recent.length).toBeGreaterThan(0);
    const missing = [...new Set(recent)].filter(
      (t) => !granted.has(t) && !closed.has(t)
    );
    expect(missing).toEqual([]);
  });
});
