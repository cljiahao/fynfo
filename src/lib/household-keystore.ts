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
 * vault is locked (no key in session) — mirrors `getVaultDekSession`.
 */
export async function getHouseholdKhSession(): Promise<Buffer | null> {
  const cookieStore = await cookies();
  const blob = cookieStore.get(HOUSEHOLD_KH_COOKIE)?.value;
  if (!blob) return null;

  try {
    return Buffer.from(openCookie(blob), 'base64');
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
 * the member's personal DEK. The raw key never leaves the server unsealed.
 */
export async function setHouseholdKhSession(kh: Buffer): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(HOUSEHOLD_KH_COOKIE, sealCookie(kh.toString('base64')), {
    ...HOUSEHOLD_COOKIE_BASE_OPTS,
    maxAge: HOUSEHOLD_COOKIE_MAX_AGE,
  });
}
