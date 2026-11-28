import { getJournalPublicKey } from '@/integrations/services/invest-api-rpc';
import { guarded, jsonResponse } from '@/lib/api-v1/guard';
import { withLogging } from '@/lib/utils/with-logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withLogging(
  'api.v1.journal.public-key',
  guarded(
    [
      'journal:append:plan',
      'journal:append:sell_flag',
      'journal:append:verdict',
    ],
    async ({ key }) => {
      const publicKey = await getJournalPublicKey(key.callerId);
      if (!publicKey) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ v: 1, public_key: publicKey });
    }
  )
);
