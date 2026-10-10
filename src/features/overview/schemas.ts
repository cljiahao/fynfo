import { z } from 'zod';
import { OVERVIEW_SOURCES } from './constants';

export const overviewSourcesSchema = z
  .array(z.enum(OVERVIEW_SOURCES))
  .min(1)
  .max(OVERVIEW_SOURCES.length)
  .refine((sources) => new Set(sources).size === sources.length);
