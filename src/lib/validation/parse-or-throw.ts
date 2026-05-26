import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Safe schema parse for server actions. Throws an opaque `AppError('VALIDATION', ...)`
 * with the flattened Zod error logged server-side. Prevents raw ZodError stack
 * surfaces from streaming back to the client.
 *
 * Usage in server actions:
 *
 *   const data = parseOrThrow(equityTradeInputSchema, input, 'equity.trade.input');
 */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  input: unknown,
  label: string
): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  logger.warn(
    { label, issues: z.flattenError(result.error) },
    'server-action input validation failed'
  );
  throw new AppError('VALIDATION', `${label}: invalid input`);
}
