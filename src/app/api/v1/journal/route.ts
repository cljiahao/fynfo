import { appendJournal } from '@/integrations/services/invest-api-rpc';
import {
  forbidden,
  guarded,
  invalidRequest,
  jsonResponse,
} from '@/lib/api-v1/guard';
import { journalAppendRequestSchema } from '@/lib/api-v1/schemas';
import { withLogging } from '@/lib/utils/with-logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withLogging(
  'api.v1.journal.append',
  guarded(
    [
      'journal:append:plan',
      'journal:append:sell_flag',
      'journal:append:verdict',
    ],
    async ({ key, body }) => {
      let raw: unknown;
      try {
        raw = JSON.parse(body);
      } catch {
        return invalidRequest();
      }
      const parsed = journalAppendRequestSchema.safeParse(raw);
      if (!parsed.success) return invalidRequest(parsed.error);
      const { event_type, occurred_at, sealed } = parsed.data;
      if (!key.scopes.includes(`journal:append:${event_type}`)) {
        return forbidden();
      }
      const id = await appendJournal(
        key.callerId,
        event_type,
        new Date(occurred_at),
        sealed
      );
      return jsonResponse({ id }, 201);
    }
  )
);
