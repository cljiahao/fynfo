import { DecryptionError } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { AppError } from './app-error';

/**
 * Canonical error responder for Next.js route handlers.
 *
 * Maps internal exception types to safe HTTP responses with no leakage of
 * stack traces, DB text, or internal paths. Logs full detail server-side.
 *
 * Usage in route handlers:
 *
 *   try { ... } catch (err) { return handleApiError('vault.unlock', err); }
 */
export function handleApiError(label: string, error: unknown): NextResponse {
  if (error instanceof ZodError) {
    logger.warn({ label, issues: error.issues }, 'validation failure');
    return NextResponse.json(
      { error: 'Invalid request', issues: z.flattenError(error) },
      { status: 400 }
    );
  }

  if (error instanceof DecryptionError) {
    logger.warn({ label }, 'decryption failure');
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  }

  if (error instanceof AppError) {
    logger.warn({ label, code: error.code }, error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  // Unknown — log full detail server-side, return opaque 500.
  logger.error({ label, err: error }, 'unhandled error');
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
