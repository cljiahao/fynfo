export const PAGE_ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth/callback',
  ENTRY: '/dashboard/entry',
  ASSETS: '/dashboard/assets',
  SALARY: '/dashboard/salary',
  EQUITY: '/dashboard/equity',
  EXPENSES: '/dashboard/expenses',
  HOUSEHOLD: '/dashboard/household',
  PROFILE: '/dashboard/profile',
} as const;

export const API_ROUTES = {
  HEALTH: '/api/health',
  VAULT: '/api/vault',
  TRACK: '/api/track',
} as const;
