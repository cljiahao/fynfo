// Single source of truth for the household-key (`K_h`) session cookie name +
// base attributes, mirroring vault-cookie.ts. The household-keystore sets and
// reads the same name; only `maxAge` differs at set time.
export const HOUSEHOLD_KH_COOKIE = 'fynfo_household_kh';

export const HOUSEHOLD_COOKIE_BASE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

// 6-hour session, matching the vault DEK cookie lifetime.
export const HOUSEHOLD_COOKIE_MAX_AGE = 60 * 60 * 6;
