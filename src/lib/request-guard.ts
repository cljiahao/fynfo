import { NextResponse } from 'next/server';

type GuardOptions = {
  /** Require a JSON content type on requests that carry a body. */
  json?: boolean;
  /** Reject declared or actual bodies larger than this many bytes. */
  maxBodyBytes?: number;
};

const SAME_ORIGIN_SITES = new Set(['same-origin', 'none']);

function deny(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

function hostOf(req: Request): string {
  return (
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    new URL(req.url).host
  );
}

function isCrossSite(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return !SAME_ORIGIN_SITES.has(site);
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== hostOf(req);
  } catch {
    return true;
  }
}

/**
 * CSRF defence in depth for unsafe-method API routes (OWASP: Fetch Metadata,
 * Origin fallback). Requests with neither header (non-browser clients) pass;
 * SameSite=Strict cookies remain the primary defence.
 */
export function rejectUnsafeRequest(
  req: Request,
  { json = false, maxBodyBytes }: GuardOptions = {}
): NextResponse | null {
  if (isCrossSite(req)) return deny(403, 'Forbidden');

  if (json && req.method !== 'DELETE') {
    const type = req.headers.get('content-type') ?? '';
    if (!/^application\/json\s*(;|$)/i.test(type)) {
      return deny(415, 'Unsupported media type');
    }
  }

  if (maxBodyBytes !== undefined) {
    const length = Number(req.headers.get('content-length') ?? 0);
    if (!Number.isFinite(length) || length > maxBodyBytes) {
      return deny(413, 'Payload too large');
    }
  }
  return null;
}

/** Reads a JSON body without trusting `content-length`; null if invalid or oversized. */
export async function readBoundedJson(
  req: Request,
  maxBytes: number
): Promise<unknown> {
  const text = await req.text().catch(() => null);
  if (text === null || Buffer.byteLength(text) > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
