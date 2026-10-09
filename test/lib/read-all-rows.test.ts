import { readAllRows } from '@/lib/read-all-rows';
import { describe, expect, it, vi } from 'vitest';

describe('readAllRows', () => {
  it('advances inclusive ranges by returned rows even below requested page size', async () => {
    const records = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const read = vi.fn(async (from: number, to: number) => ({
      data: records.slice(from, Math.min(to + 1, from + 125)),
      count: records.length,
      error: null,
    }));
    expect(await readAllRows(read, 'fixture read')).toEqual(records);
    expect(read).toHaveBeenCalledTimes(9);
    expect(read.mock.calls[0]).toEqual([0, 499]);
    expect(read.mock.calls[1]).toEqual([125, 624]);
    expect(read.mock.calls.at(-1)).toEqual([1000, 1499]);
  });

  it('does not probe beyond exact completion or empty histories', async () => {
    const records = Array.from({ length: 500 }, (_, id) => ({ id }));
    const read = vi.fn(async () => ({
      data: records,
      count: 500,
      error: null,
    }));
    expect(await readAllRows(read, 'fixture read')).toEqual(records);
    expect(read).toHaveBeenCalledTimes(1);
    expect(
      await readAllRows(
        async () => ({ data: null, count: 0, error: null }),
        'fixture read'
      )
    ).toEqual([]);
  });

  it.each([null, -1, 1.5])('rejects invalid exact count %s', async (count) => {
    await expect(
      readAllRows(
        async () => ({ data: [], count, error: null }),
        'fixture read'
      )
    ).rejects.toThrow('fixture read failed');
  });

  it.each([
    { data: [], count: 2, error: null },
    { data: [{ id: 1 }], count: 0, error: null },
    {
      data: Array.from({ length: 501 }, (_, id) => ({ id })),
      count: 501,
      error: null,
    },
  ])('rejects incomplete or oversized pages', async (page) => {
    await expect(readAllRows(async () => page, 'fixture read')).rejects.toThrow(
      'fixture read failed'
    );
  });

  it('rejects a changed count rather than return a mixed partial history', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], count: 2, error: null })
      .mockResolvedValueOnce({ data: [{ id: 2 }], count: 3, error: null });
    await expect(readAllRows(read, 'fixture read')).rejects.toThrow(
      'fixture read failed'
    );
  });

  it('rejects a later page failure with an opaque error', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], count: 2, error: null })
      .mockResolvedValueOnce({
        data: null,
        count: null,
        error: { message: 'private table details', code: '08006' },
      });
    await expect(readAllRows(read, 'fixture read')).rejects.toThrow(
      'fixture read failed'
    );
  });
});
