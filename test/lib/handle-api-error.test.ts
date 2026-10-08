import { DecryptionError } from '@/lib/crypto';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/handle-api-error';
import { logger } from '@/lib/logger';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

describe('handle-api-error — safe HTTP mapping', () => {
  it('does not log private text embedded in unknown errors', () => {
    handleApiError('test', new Error('private-account=123456 salary=9000'));
    expect(logger.error).toHaveBeenLastCalledWith(
      { label: 'test', errorType: 'Error' },
      'unhandled error'
    );
  });
  it('maps ZodError to 400 with flattened issues', async () => {
    const parsed = z.object({ a: z.string() }).safeParse({ a: 1 });
    const res = handleApiError('test', parsed.error);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid request');
    expect(body.issues).toBeTruthy();
  });

  it('maps DecryptionError to 401 "Incorrect PIN"', async () => {
    const res = handleApiError('test', new DecryptionError());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Incorrect PIN' });
  });

  it('maps AppError to its status/code/message', async () => {
    const res = handleApiError(
      'test',
      new AppError('NOT_FOUND', 'no such record')
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'no such record', code: 'NOT_FOUND' });
  });

  it('maps an unknown error to an opaque 500 with NO internal detail leaked', async () => {
    const leaky = new Error('relation "users_profile" does not exist');
    const res = handleApiError('test', leaky);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal Server Error' });
    // leak guard: the raw DB text must not reach the client
    expect(JSON.stringify(body)).not.toContain('users_profile');
  });
});
