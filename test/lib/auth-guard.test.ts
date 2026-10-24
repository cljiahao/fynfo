import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireDbContext = vi.fn();
vi.mock('@/lib/action-guard', () => ({
  requireDbContext: () => requireDbContext(),
}));

import { requireUserId } from '@/lib/auth-guard';

beforeEach(() => {
  requireDbContext.mockReset();
});

describe('requireUserId', () => {
  it('returns only the verified user id from the db context', async () => {
    requireDbContext.mockResolvedValue({ userId: 'user-1', db: {} });
    expect(await requireUserId()).toBe('user-1');
  });

  it('propagates an unauthenticated rejection', async () => {
    requireDbContext.mockRejectedValue(new Error('UNAUTHORIZED'));
    await expect(requireUserId()).rejects.toThrow('UNAUTHORIZED');
  });
});
