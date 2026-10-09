import { AppError, throwIfSupabaseError } from '@/lib/errors';

const READ_PAGE_SIZE = 500;

interface ReadPage<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
}

/** The caller supplies a fresh, owner-scoped query with a unique sort order. */
export async function readAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<ReadPage<T>>,
  context: string
): Promise<T[]> {
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
