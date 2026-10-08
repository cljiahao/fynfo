import { handleApiError } from '@/lib/errors';
import {
  HOUSEHOLD_COOKIE_BASE_OPTS,
  HOUSEHOLD_KH_COOKIE,
} from '@/lib/household-cookie';
import { withLogging } from '@/lib/utils/with-logging';
import { VAULT_COOKIE_BASE_OPTS, VAULT_DEK_COOKIE } from '@/lib/vault-cookie';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Cookie teardown must remain available after the authentication session expires.
export const POST = withLogging('api.vault.lock', async () => {
  try {
    const cookieStore = await cookies();
    cookieStore.set(VAULT_DEK_COOKIE, '', {
      ...VAULT_COOKIE_BASE_OPTS,
      maxAge: 0,
    });
    cookieStore.set(HOUSEHOLD_KH_COOKIE, '', {
      ...HOUSEHOLD_COOKIE_BASE_OPTS,
      maxAge: 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError('api.vault.lock', error);
  }
});
