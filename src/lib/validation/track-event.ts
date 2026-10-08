import { PAGE_ROUTES } from '@/lib/constants/routes';
import {
  MARKETING_EVENT_TYPES,
  TELEMETRY_PATH_MAX,
} from '@/lib/constants/telemetry';
import { z } from 'zod';

// Boundary schema for POST /api/track. Kept in its own module so the route and
// its tests validate against the exact same shape.
export const TrackEventSchema = z.object({
  eventType: z.enum(MARKETING_EVENT_TYPES),
  path: z
    .string()
    .min(1)
    .max(TELEMETRY_PATH_MAX)
    .refine((path) => path === PAGE_ROUTES.HOME || path === PAGE_ROUTES.LOGIN, {
      message: 'Unsupported public page',
    }),
});

export type TrackEventInput = z.infer<typeof TrackEventSchema>;
