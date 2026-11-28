import 'server-only';

import { z } from 'zod';

export const API_V1_BODY_MAX_BYTES = 16 * 1024;

const BASE64URL = /^[A-Za-z0-9_-]+$/;
// Postgres returns microsecond timestamps with an offset; the cursor must round-trip verbatim.
const CURSOR_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export const eventTypeSchema = z.enum(['plan', 'sell_flag', 'verdict']);

export const summaryResponseSchema = z.object({
  sealed: z.string(),
  published_at: z.string(),
});

export const publicKeyResponseSchema = z.object({
  v: z.literal(1),
  public_key: z.string(),
});

export const journalAppendRequestSchema = z.object({
  event_type: eventTypeSchema,
  occurred_at: z.iso.datetime({ offset: true }),
  sealed: z.string().min(1).max(16384).regex(BASE64URL),
});

export const journalAppendResponseSchema = z.object({ id: z.uuid() });

export const journalMetaQuerySchema = z
  .object({
    since: z.string().max(40).regex(CURSOR_TIMESTAMP).optional(),
    since_id: z.uuid().optional(),
  })
  .refine((q) => (q.since === undefined) === (q.since_id === undefined), {
    message: 'since and since_id must be given together',
  });

export const journalMetaResponseSchema = z.array(
  z.object({
    id: z.uuid(),
    caller: z.string(),
    event_type: eventTypeSchema,
    created_at: z.string(),
  })
);

export const errorResponseSchema = z.object({
  error: z.enum([
    'unauthorized',
    'forbidden',
    'invalid_request',
    'payload_too_large',
    'rate_limited',
    'not_found',
    'unavailable',
  ]),
});

/** Source of truth for docs/api/v1/*.schema.json. */
export const API_V1_SCHEMAS = {
  'summary-response': summaryResponseSchema,
  'public-key-response': publicKeyResponseSchema,
  'journal-append-request': journalAppendRequestSchema,
  'journal-append-response': journalAppendResponseSchema,
  'journal-meta-response': journalMetaResponseSchema,
  'error-response': errorResponseSchema,
} as const;
