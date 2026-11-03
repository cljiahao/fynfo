import { AppError, throwIfSupabaseError } from '@/lib/errors';

const READ_PAGE_SIZE = 500;

interface ReadPage<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
}

// Each page is a separate PostgREST round trip, so latency (not row volume)
// dominates large reads. Four in flight turns ~9 serial trips into ~3 waves
// without flooding the connection pool from a single user's request.
export const PARALLEL_READ_CONCURRENCY = 4;

class ShortPage extends Error {}

export interface ReadAllRowsOptions {
  /** Fetch pages after the first with up to this many requests in flight. */
  concurrency?: number;
}

/** The caller supplies a fresh, owner-scoped query with a unique sort order. */
export async function readAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<ReadPage<T>>,
  context: string,
  options?: ReadAllRowsOptions
): Promise<T[]> {
  if (options?.concurrency !== undefined) {
    try {
      return await readAllRowsParallel(loadPage, context, options.concurrency);
    } catch (error) {
      if (!(error instanceof ShortPage)) throw error;
      // A server row cap below the page size returns short pages with a stable
      // count; the sequential mode advances by returned rows and handles it.
      return readAllRows(loadPage, context);
    }
  }
  const rows: T[] = [];
  let expectedCount: number | undefined;

  do {
    const { data, error, count } = await loadPage(
      rows.length,
      rows.length + READ_PAGE_SIZE - 1
    );
    throwIfSupabaseError(error, context);
    if (
      count === null ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      (expectedCount !== undefined && count !== expectedCount)
    ) {
      throw new AppError('DB_ERROR', `${context} failed`);
    }
    expectedCount = count;
    const page = data ?? [];
    if (
      page.length > READ_PAGE_SIZE ||
      rows.length + page.length > count ||
      (page.length === 0 && rows.length < count)
    ) {
      throw new AppError('DB_ERROR', `${context} failed`);
    }
    rows.push(...page);
  } while (rows.length < expectedCount);

  return rows;
}

// Offsets are fixed up front, so unlike the sequential mode every page must be
// exactly full (or the exact remainder); a short page cannot be re-based.
async function readAllRowsParallel<T>(
  loadPage: (from: number, to: number) => PromiseLike<ReadPage<T>>,
  context: string,
  concurrency: number
): Promise<T[]> {
  const fail = () => new AppError('DB_ERROR', `${context} failed`);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw fail();

  const loadChecked = async (offset: number, expectedCount?: number) => {
    const { data, error, count } = await loadPage(
      offset,
      offset + READ_PAGE_SIZE - 1
    );
    throwIfSupabaseError(error, context);
    if (
      count === null ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      (expectedCount !== undefined && count !== expectedCount)
    ) {
      throw fail();
    }
    const page = data ?? [];
    const expectedLength = Math.min(READ_PAGE_SIZE, count - offset);
    if (page.length > 0 && page.length < expectedLength) throw new ShortPage();
    if (page.length !== expectedLength) throw fail();
    return { page, count };
  };

  const first = await loadChecked(0);
  const offsets: number[] = [];
  for (
    let offset = READ_PAGE_SIZE;
    offset < first.count;
    offset += READ_PAGE_SIZE
  ) {
    offsets.push(offset);
  }

  const pages = new Array<T[]>(offsets.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < offsets.length) {
      const index = next++;
      try {
        pages[index] = (await loadChecked(offsets[index], first.count)).page;
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, offsets.length) }, worker)
  );

  return first.page.concat(...pages);
}
