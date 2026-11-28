import { z } from 'zod';

export const CALLER_PRESETS = {
  atlas: ['summary:read', 'journal:meta'],
  ballast: ['summary:read', 'journal:append:plan', 'journal:append:sell_flag'],
  acciaux: ['journal:append:verdict'],
} as const;

export type CallerPreset = keyof typeof CALLER_PRESETS;
export const CALLER_PRESET_NAMES = ['atlas', 'ballast', 'acciaux'] as const;

// Raw 32-byte key, base64: 43 chars plus one padding char.
const publicKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]{43}=$/, 'Must be a 32-byte key in base64 (44 chars)');

// Mirrors the invest_api_callers.name CHECK constraint.
export const callerNameSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_-]{1,31}$/,
    'Use 2-32 chars: lowercase letters, digits, - or _, starting with a letter'
  );

export const createCallerInputSchema = z.object({
  name: callerNameSchema,
  preset: z.enum(CALLER_PRESET_NAMES),
  signingPublicKey: publicKeySchema,
  sealingPublicKey: publicKeySchema,
});

export const addKeyInputSchema = z.object({
  callerId: z.uuid(),
  signingPublicKey: publicKeySchema,
});

export const revokeKeyInputSchema = z.object({ keyId: z.uuid() });
export const revokeCallerInputSchema = z.object({ callerId: z.uuid() });

export const setSealingKeyInputSchema = z.object({
  callerId: z.uuid(),
  sealingPublicKey: publicKeySchema,
});

export type CreateCallerInput = z.infer<typeof createCallerInputSchema>;
export type AddKeyInput = z.infer<typeof addKeyInputSchema>;
export type SetSealingKeyInput = z.infer<typeof setSealingKeyInputSchema>;

export type CallerKey = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type CallerSummary = {
  id: string;
  name: string;
  preset: CallerPreset | null;
  scopes: string[];
  sealingFingerprint: string;
  createdAt: string;
  revokedAt: string | null;
  keys: CallerKey[];
};

export type CallerActionResult<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export function isKeyActive(key: CallerKey, now: number): boolean {
  return key.revokedAt === null && new Date(key.expiresAt).getTime() > now;
}
