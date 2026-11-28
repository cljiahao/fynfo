import { getSealedSummary } from '@/integrations/services/invest-api-rpc';
import { guarded, jsonResponse } from '@/lib/api-v1/guard';
import { withLogging } from '@/lib/utils/with-logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withLogging(
  'api.v1.summary',
  guarded(['summary:read'], async ({ key }) => {
    const summary = await getSealedSummary(key.callerId);
    if (!summary) return jsonResponse({ error: 'not_found' }, 404);
    return jsonResponse({
      sealed: summary.sealed,
      published_at: summary.publishedAt,
    });
  })
);
