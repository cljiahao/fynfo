import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

/**
 * Wraps a Next.js route handler with structured request logging.
 * Logs method, path, status, duration_ms, requestId. Sets `x-request-id`
 * on the outgoing response when the header bag is mutable; never reconstructs
 * the response (would lose Next.js cookie attachments / streaming behavior).
 */
export function withLogging(
  label: string,
  handler: RouteHandler
): RouteHandler {
  return async (req, ctx) => {
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    const startedAt = Date.now();
    const method = req.method;
    const path = new URL(req.url).pathname;

    try {
      const response = await handler(req, ctx);
      try {
        response.headers.set('x-request-id', requestId);
      } catch {
        // Some framework responses ship immutable headers; correlation id is best-effort.
      }
      const durationMs = Date.now() - startedAt;
      logger.info(
        {
          label,
          requestId,
          method,
          path,
          status: response.status,
          durationMs,
        },
        'request handled'
      );
      return response;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      logger.error(
        { label, requestId, method, path, durationMs, err },
        'request errored'
      );
      throw err;
    }
  };
}
