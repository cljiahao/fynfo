import {
  parseAuthorizationHeader,
  parseSignedRequestHeaders,
} from '@/lib/api-v1/caller-key';
import {
  SIGNATURE_WINDOW_SECONDS,
  buildCanonicalString,
  isTimestampFresh,
  sha256Hex,
  signatureNonceHash,
  verifyRequestSignature,
  type SignedRequest,
} from '@/lib/api-v1/request-signature';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

const KEY_ID = '123e4567-e89b-42d3-a456-426614174000';
const NOW_MS = Date.UTC(2026, 10, 28, 12, 0, 0);
const TS = String(NOW_MS / 1000);

function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = Buffer.from(
    publicKey.export({ format: 'jwk' }).x ?? '',
    'base64url'
  );
  return { privateKey, publicB64: raw.toString('base64') };
}

function request(overrides: Partial<SignedRequest> = {}): SignedRequest {
  return {
    keyId: KEY_ID,
    timestamp: TS,
    method: 'POST',
    pathWithQuery: '/api/v1/journal?x=1',
    body: '{"event_type":"plan"}',
    ...overrides,
  };
}

function sign(privateKey: crypto.KeyObject, req: SignedRequest): string {
  return crypto
    .sign(null, Buffer.from(buildCanonicalString(req)), privateKey)
    .toString('base64');
}

describe('buildCanonicalString', () => {
  it('matches the documented layout', () => {
    expect(buildCanonicalString(request({ method: 'post' }))).toBe(
      [
        'fynfo-req-v1',
        KEY_ID,
        TS,
        'POST',
        '/api/v1/journal?x=1',
        sha256Hex('{"event_type":"plan"}'),
      ].join('\n')
    );
  });

  it('hashes an empty body as the empty string', () => {
    expect(buildCanonicalString(request({ body: '' })).split('\n')[5]).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});

describe('verifyRequestSignature', () => {
  const { privateKey, publicB64 } = keypair();

  it('accepts a good signature and returns the nonce expiry', () => {
    const req = request();
    const result = verifyRequestSignature(
      req,
      publicB64,
      sign(privateKey, req),
      NOW_MS
    );
    expect(result).toEqual({
      ok: true,
      nonceExpiresAt: new Date(NOW_MS + SIGNATURE_WINDOW_SECONDS * 1000),
    });
  });

  it('accepts timestamps at the window edge and rejects just outside', () => {
    for (const offset of [-300, 300]) {
      const req = request({ timestamp: String(NOW_MS / 1000 + offset) });
      expect(
        verifyRequestSignature(req, publicB64, sign(privateKey, req), NOW_MS).ok
      ).toBe(true);
    }
    for (const offset of [-301, 301]) {
      const req = request({ timestamp: String(NOW_MS / 1000 + offset) });
      expect(
        verifyRequestSignature(req, publicB64, sign(privateKey, req), NOW_MS)
      ).toEqual({ ok: false, reason: 'stale_timestamp' });
    }
  });

  it('rejects a malformed timestamp', () => {
    const req = request({ timestamp: '12.5' });
    expect(
      verifyRequestSignature(req, publicB64, sign(privateKey, req), NOW_MS)
    ).toEqual({ ok: false, reason: 'bad_timestamp' });
  });

  it('rejects a tampered body, path, method, key id and timestamp', () => {
    const signature = sign(privateKey, request());
    const tampered: Partial<SignedRequest>[] = [
      { body: '{"event_type":"verdict"}' },
      { pathWithQuery: '/api/v1/journal?x=2' },
      { method: 'GET' },
      { keyId: '123e4567-e89b-42d3-a456-426614174001' },
      { timestamp: String(NOW_MS / 1000 + 1) },
    ];
    for (const change of tampered) {
      expect(
        verifyRequestSignature(request(change), publicB64, signature, NOW_MS)
      ).toEqual({ ok: false, reason: 'bad_signature' });
    }
  });

  it('rejects the wrong key, a malformed key and a malformed signature', () => {
    const req = request();
    const signature = sign(privateKey, req);
    expect(
      verifyRequestSignature(req, keypair().publicB64, signature, NOW_MS)
    ).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyRequestSignature(req, 'AAAA', signature, NOW_MS)).toEqual({
      ok: false,
      reason: 'bad_key',
    });
    expect(verifyRequestSignature(req, publicB64, 'AAAA', NOW_MS)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('hashes the raw signature bytes for the nonce table', () => {
    const signature = sign(privateKey, request());
    expect(signatureNonceHash(signature)).toBe(
      sha256Hex(Buffer.from(signature, 'base64'))
    );
    expect(signatureNonceHash(signature)).toHaveLength(64);
  });

  it('checks timestamp freshness', () => {
    expect(isTimestampFresh(TS, NOW_MS)).toBe(true);
    expect(isTimestampFresh('abc', NOW_MS)).toBe(false);
    expect(isTimestampFresh('', NOW_MS)).toBe(false);
  });
});

describe('caller-key header parsing', () => {
  const signature = Buffer.alloc(64, 7).toString('base64');
  const headers = (values: Record<string, string>) =>
    new Headers(values) as Pick<Headers, 'get'>;

  it('parses a valid authorization header and normalizes the case', () => {
    expect(parseAuthorizationHeader(`Fynfo-Ed25519 keyId=${KEY_ID}`)).toEqual({
      ok: true,
      keyId: KEY_ID,
    });
    expect(
      parseAuthorizationHeader(`Fynfo-Ed25519 keyId=${KEY_ID.toUpperCase()}`)
    ).toEqual({ ok: true, keyId: KEY_ID });
  });

  it('rejects malformed authorization headers', () => {
    const bad = [
      null,
      '',
      'Bearer abc',
      'Fynfo-Ed25519',
      'Fynfo-Ed25519 keyId=',
      'Fynfo-Ed25519 keyId=not-a-uuid',
      `Fynfo-Ed25519 keyId=${KEY_ID} extra`,
      `fynfo-ed25519 keyId=${KEY_ID}`,
      `Fynfo-Ed25519  keyId=${KEY_ID}`,
      `Fynfo-Ed25519 keyId=${KEY_ID}\n`,
      'Fynfo-Ed25519 keyId=123e4567e89b42d3a456426614174000aaaa',
    ];
    for (const header of bad) {
      expect(parseAuthorizationHeader(header)).toEqual({
        ok: false,
        reason: 'malformed',
      });
    }
  });

  it('parses the full header set', () => {
    expect(
      parseSignedRequestHeaders(
        headers({
          authorization: `Fynfo-Ed25519 keyId=${KEY_ID}`,
          'x-fynfo-timestamp': TS,
          'x-fynfo-signature': signature,
        })
      )
    ).toEqual({
      ok: true,
      value: { keyId: KEY_ID, timestamp: TS, signature },
    });
  });

  it('rejects missing or malformed timestamp and signature headers', () => {
    const base = { authorization: `Fynfo-Ed25519 keyId=${KEY_ID}` };
    const cases: Record<string, string>[] = [
      base,
      { ...base, 'x-fynfo-timestamp': TS },
      { ...base, 'x-fynfo-signature': signature },
      { ...base, 'x-fynfo-timestamp': '1.5', 'x-fynfo-signature': signature },
      { ...base, 'x-fynfo-timestamp': '-5', 'x-fynfo-signature': signature },
      {
        ...base,
        'x-fynfo-timestamp': '12345678901',
        'x-fynfo-signature': signature,
      },
      { ...base, 'x-fynfo-timestamp': TS, 'x-fynfo-signature': 'AAAA' },
      {
        ...base,
        'x-fynfo-timestamp': TS,
        'x-fynfo-signature': Buffer.alloc(63, 1).toString('base64'),
      },
    ];
    for (const set of cases) {
      expect(parseSignedRequestHeaders(headers(set))).toEqual({
        ok: false,
        reason: 'malformed',
      });
    }
  });
});
