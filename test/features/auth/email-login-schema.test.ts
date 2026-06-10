import { emailLoginSchema } from '@/features/auth/lib/email-login-schema';
import { describe, expect, it } from 'vitest';

describe('emailLoginSchema', () => {
  it('accepts a valid email + non-empty password', () => {
    expect(
      emailLoginSchema.safeParse({ email: 'a@b.com', password: 'hunter2' })
        .success
    ).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(
      emailLoginSchema.safeParse({ email: 'not-an-email', password: 'x' })
        .success
    ).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(
      emailLoginSchema.safeParse({ email: 'a@b.com', password: '' }).success
    ).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(emailLoginSchema.safeParse({ email: 'a@b.com' }).success).toBe(
      false
    );
    expect(emailLoginSchema.safeParse({ password: 'x' }).success).toBe(false);
  });
});
