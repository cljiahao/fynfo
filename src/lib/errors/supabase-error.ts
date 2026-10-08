import { logger } from '@/lib/logger';
import { AppError } from './app-error';

interface SupabaseLikeError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Logs database classification without private values and throws an opaque
 * AppError so client responses never include table names, constraint names,
 * SQL fragments, or other internal detail.
 */
export function throwIfSupabaseError(
  error: SupabaseLikeError | null | undefined,
  context: string
): asserts error is null | undefined {
  if (!error) return;
  logger.error(
    {
      context,
      code: error.code,
    },
    'supabase error'
  );
  throw new AppError('DB_ERROR', `${context} failed`);
}
