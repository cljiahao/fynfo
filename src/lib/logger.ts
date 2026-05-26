import { isDev } from '@/lib/constants';
import pino, { type Logger } from 'pino';
import 'server-only';

/**
 * Pino logger with PII / secret redaction baked in.
 *
 * Redact paths cover anything that could leak through structured logging
 * — vault DEKs, Supabase keys, PINs, encrypted payloads, cookie blobs.
 *
 * Pretty-prints in dev for readability; JSON in prod for log aggregators.
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  base: { service: 'fynfo' },
  redact: {
    paths: [
      'password',
      'pin',
      'derivedKey',
      'dek',
      'vault_check',
      'vault_check_v2',
      'cookie',
      'authorization',
      '*.password',
      '*.pin',
      '*.derivedKey',
      '*.dek',
      '*.token',
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'SESSION_SECRET',
      // Encrypted-payload field names — never log decrypted values
      'ticker',
      'shares',
      'price',
      'fees',
      'amount',
      'salary',
      'bonus',
      'item',
      'info',
      'account',
      'email',
      '*.ticker',
      '*.shares',
      '*.price',
      '*.fees',
      '*.amount',
      '*.salary',
      '*.bonus',
      '*.item',
      '*.info',
      '*.account',
      '*.email',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service',
        },
      }
    : undefined,
});
