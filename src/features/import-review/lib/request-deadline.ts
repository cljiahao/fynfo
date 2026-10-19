import { IMPORT_REQUEST_TIMEOUT_MS } from '@/features/expenses';
import { withDeadline } from '@/lib/with-deadline';

/** A timeout releases the review, not the server write: outcomes stay unknown. */
export async function withImportDeadline<T>(request: Promise<T>): Promise<T> {
  return withDeadline(request, IMPORT_REQUEST_TIMEOUT_MS);
}
