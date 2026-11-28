import 'server-only';

import {
  authenticateKey,
  consumeNonce,
  pruneInvestApi,
  writeAudit,
  type AuthenticatedKey,
  type InvestScope,
} from '@/integrations/services/invest-api-rpc';
import { consumeRateLimit } from '@/integrations/services/security-rpc';
import { parseSignedRequestHeaders } from '@/lib/api-v1/caller-key';
import {
  signatureNonceHash,
  verifyRequestSignature,
} from '@/lib/api-v1/request-signature';
import { API_V1_BODY_MAX_BYTES } from '@/lib/api-v1/schemas';
import { logger } from '@/lib/logger';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;
// Nonce and audit rows expire in the database; pruning a fraction of requests avoids a cron.
const PRUNE_PROBABILITY = 0.01;

const NO_STORE = { 'Cache-Control': 'no-store' };

export type GuardContext = {
  key: AuthenticatedKey;
  keyId: string;
  /** Raw request body, already covered by the verified signature. */
  body: string;
};

export type ScopeRequirement = readonly InvestScope[];

export type GuardedHandler = (ctx: GuardContext) => Promise<Response>;

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE, ...headers },
  });
}

export function forbidden(): NextResponse {
  return jsonResponse({ error: 'forbidden' }, 403);
}

export function invalidRequest(error?: z.ZodError): NextResponse {
  return jsonResponse(
    {
      error: 'invalid_request',
      ...(error ? { issues: z.flattenError(error) } : {}),
    },
    400
  );
}

// Every authentication failure shares this exact response so a caller cannot tell an unknown key
// from a bad signature, a replay or an expired key.
function unauthorized(): NextResponse {
  return jsonResponse({ error: 'unauthorized' }, 401);
}

class BodyTooLarge extends Error {}

async function readCappedBody(req: Request): Promise<Uint8Array> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declared) || declared > API_V1_BODY_MAX_BYTES) {
    throw new BodyTooLarge();
  }
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > API_V1_BODY_MAX_BYTES) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function audit(
  key: AuthenticatedKey | null,
  keyId: string | null,
  endpoint: string,
  status: number
): Promise<void> {
  try {
    await writeAudit(key?.callerId ?? null, keyId, endpoint, status);
  } catch {
    logger.warn({ endpoint, status }, 'invest api audit write failed');
  }
}

async function maybePrune(): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  try {
    await pruneInvestApi();
  } catch {
    logger.warn('invest api prune failed');
  }
}

type AuthResult =
  | { ok: true; key: AuthenticatedKey; keyId: string }
  | { ok: false; key: AuthenticatedKey | null; keyId: string | null };

async function authenticate(
  req: Request,
  body: Uint8Array
): Promise<AuthResult> {
  const headers = parseSignedRequestHeaders(req.headers);
  if (!headers.ok) return { ok: false, key: null, keyId: null };
  const { keyId, timestamp, signature } = headers.value;
  const key = await authenticateKey(keyId);
  if (!key) return { ok: false, key: null, keyId };
  const url = new URL(req.url);
  const verified = verifyRequestSignature(
    {
      keyId,
      timestamp,
      method: req.method,
      pathWithQuery: `${url.pathname}${url.search}`,
      body,
    },
    key.publicKey,
    signature
  );
  if (!verified.ok) return { ok: false, key, keyId };
  const fresh = await consumeNonce(
    signatureNonceHash(signature),
    verified.nonceExpiresAt
  );
  if (!fresh) return { ok: false, key, keyId };
  return { ok: true, key, keyId };
}

/**
 * Wraps a handler with the investment API guard: body cap, signature, replay, scope, per-key rate
 * limit and audit. `required` is satisfied by holding any one listed scope; a handler that needs
 * a finer check (journal event type) returns `forbidden()` itself.
 */
export function guarded(
  required: ScopeRequirement,
  handler: GuardedHandler
): (req: Request) => Promise<Response> {
  return async (req) => {
    const url = new URL(req.url);
    const endpoint = `${req.method} ${url.pathname}`;
    let key: AuthenticatedKey | null = null;
    let keyId: string | null = null;
    let response: Response;
    try {
      const body = await readCappedBody(req);
      const auth = await authenticate(req, body);
      key = auth.key;
      keyId = auth.keyId;
      if (!auth.ok) {
        response = unauthorized();
      } else if (!required.some((scope) => auth.key.scopes.includes(scope))) {
        response = forbidden();
      } else if (
        !(await consumeRateLimit(
          `invest-api:${auth.keyId}`,
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_SECONDS
        ))
      ) {
        response = jsonResponse({ error: 'rate_limited' }, 429, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      } else {
        response = await handler({
          key: auth.key,
          keyId: auth.keyId,
          body: new TextDecoder().decode(body),
        });
      }
    } catch (error) {
      if (error instanceof BodyTooLarge) {
        response = jsonResponse({ error: 'payload_too_large' }, 413);
      } else {
        logger.error({ endpoint }, 'invest api request failed');
        response = jsonResponse({ error: 'unavailable' }, 503);
      }
    }
    // Requests without a parseable key id are unauthenticated noise; auditing them would let
    // anyone drive database writes.
    if (keyId) await audit(key, keyId, endpoint, response.status);
    after(maybePrune);
    return response;
  };
}
