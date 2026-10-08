import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/utils/with-logging';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

describe('withLogging', () => {
  it('propagates errors while keeping their private text out of logs', async () => {
    const error = new Error('private-account=123456 salary=9000');
    const handler = withLogging('test', async () => {
      throw error;
    });
    await expect(
      handler(new Request('http://localhost/api/test'))
    ).rejects.toBe(error);
    expect(logger.error).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: 'test', errorType: 'Error' }),
      'request errored'
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'private-account'
    );
  });
  it('generates correlation IDs instead of logging caller-controlled values', async () => {
    const handler = withLogging('test', async () => new Response('ok'));
    const suppliedId = 'private-account-' + 'x'.repeat(5000);
    const response = await handler(
      new Request('http://localhost/api/test', {
        headers: { 'x-request-id': suppliedId },
      })
    );
    const requestId = response.headers.get('x-request-id');
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ requestId }),
      'request handled'
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(
      suppliedId
    );
  });
});
