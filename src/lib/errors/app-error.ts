export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'VAULT_LOCKED'
  | 'VAULT_REJECTED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DB_ERROR'
  | 'EXTERNAL_API'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  VAULT_LOCKED: 401,
  VAULT_REJECTED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DB_ERROR: 500,
  EXTERNAL_API: 502,
  INTERNAL: 500,
};

/**
 * Domain error type for fynfo. Always surface a client-safe `message`;
 * keep internal details (DB errors, Supabase responses, stack traces)
 * in the logger, not in the message field.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
