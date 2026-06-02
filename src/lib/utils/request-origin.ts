import { headers } from 'next/headers';

/**
 * Resolves the public-facing origin of the current request.
 *
 * Honors `TRUST_PROXY` env: when set (comma-separated trusted host list, or "1"
 * for "trust any"), `X-Forwarded-Proto` and `X-Forwarded-Host` are read from
 * the request headers. When empty/unset, falls back to `host` header and
 * `NEXT_PUBLIC_BASE_URL` derived scheme — never trusts forwarded headers.
 *
 * Two topologies must be supported:
 *  - one-hop (ALB → App): TRUST_PROXY is the ALB's address
 *  - two-hop (ALB → Traefik → App): TRUST_PROXY is comma-separated [ALB, Traefik]
 */

/**
 * Whether a forwarded host may be honored, given the raw `TRUST_PROXY` value.
 * `'1'` trusts any host; otherwise the host must appear (case-insensitive,
 * port included) in the comma-separated allow-list. Empty list trusts nothing.
 * Pure — unit-testable without `next/headers`.
 */
export function isForwardedHostAllowed(
  host: string,
  trustProxy: string
): boolean {
  const tp = trustProxy.trim();
  if (!tp) return false;
  if (tp === '1') return true;
  const allowed = tp
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(host.trim().toLowerCase());
}

export async function getAppOrigin(): Promise<string> {
  const trustProxy = (process.env.TRUST_PROXY ?? '').trim();
  const h = await headers();

  if (trustProxy) {
    const fwdProto = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const fwdHost = h.get('x-forwarded-host')?.split(',')[0]?.trim();
    if (fwdProto && fwdHost && isForwardedHostAllowed(fwdHost, trustProxy)) {
      return `${fwdProto}://${fwdHost}`;
    }
  }

  const host = h.get('host');
  if (host) {
    const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${scheme}://${host}`;
  }

  return process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
}
