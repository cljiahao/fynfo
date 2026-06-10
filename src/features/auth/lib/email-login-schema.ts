import { z } from 'zod';

// Sign-in only (no public sign-up). Kept in its own module so the form and its
// tests validate against the exact same shape.
export const emailLoginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type EmailLoginValues = z.infer<typeof emailLoginSchema>;
