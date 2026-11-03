import { readAllRows } from '@/lib/read-all-rows';
import { describe, expect, it, vi } from 'vitest';

const makeRows = (n: number) => Array.from({ length: n }, (_, id) => ({ id }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('readAllRows parallel mode', () => {
  it('assembles rows in offset order when pages resolve out of order', async () => {
    const rows = makeRows(2300);
    const delays = new Map([
      [500, 30],
      [1000, 5],
      [1500, 20],
      [2000, 0],
    ]);
    const read = vi.fn(async (from: number, to: number) => {
      await sleep(delays.get(from) ?? 0);
      return {
        data: rows.slice(from, to + 1),
        count: rows.length,
        error: null,
      };
    });
    expect(await readAllRows(read, 'fixture read', { concurrency: 4 })).toEqual(
      rows
    );
    expect(read).toHaveBeenCalledTimes(5);
  });

  it('fetches the first page alone and respects the concurrency bound', async () => {
    const rows = makeRows(4410);
    let inFlight = 0;
    let maxInFlight = 0;
    const inFlightAtFirstPage: number[] = [];
    const read = vi.fn(async (from: number, to: number) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (from === 0) inFlightAtFirstPage.push(inFlight);
      await sleep(5);
      inFlight--;
      return {
        data: rows.slice(from, to + 1),
        count: rows.length,
        error: null,
      };
    });
    expect(await readAllRows(read, 'fixture read', { concurrency: 3 })).toEqual(
      rows
    );
    expect(inFlightAtFirstPage).toEqual([1]);
    expect(maxInFlight).toBe(3);
    expect(read).toHaveBeenCalledTimes(9);
  });

  it('handles single-page and zero-row reads without extra requests', async () => {
    const full = makeRows(500);
    const one = vi.fn(async () => ({ data: full, count: 500, error: null }));
    expect(await readAllRows(one, 'fixture read', { concurrency: 4 })).toEqual(
      full
    );
    expect(one).toHaveBeenCalledTimes(1);
    const zero = vi.fn(async () => ({ data: null, count: 0, error: null }));
    expect(await readAllRows(zero, 'fixture read', { concurrency: 4 })).toEqual(
      []
    );
    expect(zero).toHaveBeenCalledTimes(1);
  });

  it('rejects a count that changes on a later page', async () => {
    const rows = makeRows(1200);
    const read = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      count: from === 1000 ? 1201 : rows.length,
      error: null,
    }));
    await expect(
      readAllRows(read, 'fixture read', { concurrency: 4 })
    ).rejects.toThrow('fixture read failed');
  });

  it('rejects a short non-final page', async () => {
    const rows = makeRows(1200);
    const read = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, from === 500 ? from + 499 : to + 1),
      count: rows.length,
      error: null,
    }));
    await expect(
      readAllRows(read, 'fixture read', { concurrency: 4 })
    ).rejects.toThrow('fixture read failed');
  });

  it('rejects an over-long or short final page', async () => {
    const rows = makeRows(1400);
    const withFinalLength = (length: number) =>
      vi.fn(async (from: number, to: number) => ({
        data:
          from === 1000
            ? rows.slice(from, from + length)
            : rows.slice(from, to + 1),
        count: 1200,
        error: null,
      }));
    for (const length of [201, 199]) {
      await expect(
        readAllRows(withFinalLength(length), 'fixture read', {
          concurrency: 4,
        })
      ).rejects.toThrow('fixture read failed');
    }
  });

  it('rejects the whole read when any page errors', async () => {
    const rows = makeRows(2000);
    const read = vi.fn(async (from: number, to: number) => ({
      data: from === 1000 ? null : rows.slice(from, to + 1),
      count: rows.length,
      error: from === 1000 ? { message: 'boom', code: '08006' } : null,
    }));
    await expect(
      readAllRows(read, 'fixture read', { concurrency: 4 })
    ).rejects.toThrow('fixture read failed');
  });

  it('rejects an invalid concurrency', async () => {
    const read = vi.fn(async () => ({ data: [], count: 0, error: null }));
    await expect(
      readAllRows(read, 'fixture read', { concurrency: 0 })
    ).rejects.toThrow('fixture read failed');
    expect(read).not.toHaveBeenCalled();
  });
});
