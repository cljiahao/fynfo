import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const TICKER_RE = /^[A-Z0-9.\-:]{1,16}$/;

const CALENDAR_DATE = z.iso.date();
const recordDateSchema = z
  .string()
  .regex(ISO_DATE, 'date must be ISO-8601 (YYYY-MM-DD or full timestamp)')
  .refine(
    (value) =>
      CALENDAR_DATE.safeParse(value.slice(0, 10)).success &&
      !Number.isNaN(Date.parse(value)),
    'date is not a valid calendar date'
  );

export const equityTradeInputSchema = z.object({
  date: recordDateSchema,
  broker: z.string().min(1).max(64),
  ticker: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(TICKER_RE, 'ticker must be 1-16 chars [A-Z0-9.-:]')),
  action: z.enum(['buy', 'sell']),
  shares: z.number().positive().finite(),
  price: z.number().positive().finite(),
  fees: z.number().min(0).finite(),
  isCdp: z.boolean().optional(),
  isPO: z.boolean().optional(),
});

export const dividendInputSchema = z.object({
  date: recordDateSchema,
  ticker: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(TICKER_RE, 'ticker must be 1-16 chars [A-Z0-9.-:]')),
  amount: z.number().positive().finite(),
  currency: z.enum(['SGD', 'USD']),
});
