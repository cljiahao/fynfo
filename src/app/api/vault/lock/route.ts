import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { AppError, handleApiError } from '@/lib/errors';
import { withLogging } from '@/lib/utils/with-logging';
import { VAULT_COOKIE_BASE_OPTS, VAULT_DEK_COOKIE } from '@/lib/vault-cookie';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Idle auto-lock endpoint (spec security/008). Clears the sealed DEK cookie so
// the vault overlay re-appears; the Supabase auth session is left untouched.
// Never reads or logs the cookie value — only deletes it.
export const POST = withLogging('api.vault.lock', async () => {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AppError('UNAUTHORIZED', 'Unauthorized');
    }

    const cookieStore = await cookies();
    cookieStore.set(VAULT_DEK_COOKIE, '', {
      ...VAULT_COOKIE_BASE_OPTS,
      maxAge: 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.lock', error);
  }
});
