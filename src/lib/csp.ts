const STATIC_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
];

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

/**
 * Per-request CSP. `strict-dynamic` lets nonce'd Next scripts load their chunks;
 * `wasm-unsafe-eval` is for pdf.js. Styles keep `unsafe-inline` because React
 * `style` attributes and chart libraries emit inline styles.
 */
export function buildCsp(
  nonce: string,
  supabaseUrl: string,
  dev: boolean
): string {
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'wasm-unsafe-eval'",
    ...(dev ? ["'unsafe-eval'"] : []),
  ];
  const connect = ["'self'", new URL(supabaseUrl).origin];
  if (dev) connect.push('ws:', 'http://localhost:*');
  return [
    ...STATIC_DIRECTIVES,
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect.join(' ')}`,
  ].join('; ');
}
