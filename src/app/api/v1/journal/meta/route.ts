import { listJournalMeta } from '@/integrations/services/invest-api-rpc';
import { guarded, invalidRequest, jsonResponse } from '@/lib/api-v1/guard';
import { journalMetaQuerySchema } from '@/lib/api-v1/schemas';
import { withLogging } from '@/lib/utils/with-logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cursor query is read from the request URL, which the guard has already bound into the signature.
export const GET = withLogging('api.v1.journal.meta', (req: Request) =>
  guarded(['journal:meta'], async ({ key }) => {
    const params = new URL(req.url).searchParams;
    const parsed = journalMetaQuerySchema.safeParse({
      since: params.get('since') ?? undefined,
      since_id: params.get('since_id') ?? undefined,
    });
    if (!parsed.success) return invalidRequest(parsed.error);
    const { since, since_id } = parsed.data;
    const rows = await listJournalMeta(
      key.userId,
      since !== undefined && since_id !== undefined
        ? { createdAt: since, id: since_id }
        : null
    );
    const last = rows.at(-1);
    return jsonResponse(
      rows,
      200,
      last
        ? { 'X-Next-Since': last.created_at, 'X-Next-Since-Id': last.id }
        : {}
    );
  })(req)
);
