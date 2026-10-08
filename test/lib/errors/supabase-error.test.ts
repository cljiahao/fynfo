import { AppError } from '@/lib/errors/app-error';
import { throwIfSupabaseError } from '@/lib/errors/supabase-error';
import { logger } from '@/lib/logger';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

describe('throwIfSupabaseError', () => {
  it('logs classification without database text or private values', () => {
    expect(() =>
      throwIfSupabaseError(
        {
          code: '23505',
          message: 'private@example.test',
          details: 'salary=9000',
          hint: 'account=1234',
        },
        'expense upsert'
      )
    ).toThrow();
    expect(logger.error).toHaveBeenLastCalledWith(
      { context: 'expense upsert', code: '23505' },
      'supabase error'
    );
  });
  it('is a no-op for null / undefined', () => {
    expect(() => throwIfSupabaseError(null, 'ctx')).not.toThrow();
    expect(() => throwIfSupabaseError(undefined, 'ctx')).not.toThrow();
  });

  it('throws an opaque AppError(DB_ERROR) that leaks no raw detail', () => {
    const raw = {
      message: 'duplicate key value violates unique constraint "users_pkey"',
      code: '23505',
      details: 'Key (id)=(abc) already exists.',
      hint: 'secret hint',
    };

    let caught: unknown;
    try {
      throwIfSupabaseError(raw, 'expense upsert');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(AppError);
    const err = caught as AppError;
    expect(err.code).toBe('DB_ERROR');
    expect(err.message).toBe('expense upsert failed');
    // None of the raw Postgres detail must appear in the client-facing message.
    expect(err.message).not.toContain('constraint');
    expect(err.message).not.toContain('23505');
    expect(err.message).not.toContain('users_pkey');
  });
});
