import { openCookie, sealCookie } from '@/lib/cookie-seal';
import {
  HOUSEHOLD_COOKIE_BASE_OPTS,
  HOUSEHOLD_COOKIE_MAX_AGE,
  HOUSEHOLD_KH_COOKIE,
} from '@/lib/household-cookie';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

/**
 * Resolves the household key `K_h` for server actions that read/write household
 * data (constitution §2.3 third exception, §5.1a). Returns null if the household
 * vault is locked or the key envelope does not match authenticated userId.
 * The caller authenticates identity once before invoking this getter.
 */
export async function getHouseholdKhSession(
  userId: string
): Promise<Buffer | null> {
  const cookieStore = await cookies();
  const blob = cookieStore.get(HOUSEHOLD_KH_COOKIE)?.value;
  if (!blob) return null;

  try {
    return Buffer.from(openCookie(blob, userId, 'household-kh'), 'base64');
  } catch {
    logger.warn(
      'household session cookie decrypt failed (likely tamper / stale)'
    );
    return null;
  }
}

/**
 * Seals `K_h` into the `fynfo_household_kh` HttpOnly cookie. Called by
 * createHousehold / unlockHousehold / acceptInvite after `K_h` is unwrapped with
 * the member's personal DEK. userId is the authenticated member identity;
 * invalid identities or non-256-bit keys fail before writing the cookie.
 */
export async function setHouseholdKhSession(
  kh: Buffer,
  userId: string
): Promise<void> {
  const sealed = sealCookie(kh.toString('base64'), userId, 'household-kh');
  const cookieStore = await cookies();
  cookieStore.set(HOUSEHOLD_KH_COOKIE, sealed, {
    ...HOUSEHOLD_COOKIE_BASE_OPTS,
    maxAge: HOUSEHOLD_COOKIE_MAX_AGE,
  });
}
