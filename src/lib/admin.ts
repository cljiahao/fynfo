/**
 * Admin allowlist parsing. Admins are identified by email address, supplied via
 * the `ADMIN_EMAILS` env var as a comma-separated list. Comparison is
 * case-insensitive. Kept pure + env-free so it is trivially unit-testable;
 * callers pass `process.env` in.
 */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(
  email: string | undefined | null,
  raw: string | undefined | null
): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).includes(email.trim().toLowerCase());
}
