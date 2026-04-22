import { z } from 'zod';

export const equityTradeInputSchema = z.object({
  date: z.string().min(1),
  broker: z.string().min(1),
  ticker: z.string().min(1),
  action: z.enum(['buy', 'sell']),
  shares: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().min(0),
});
