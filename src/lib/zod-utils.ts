import { z } from 'zod';

export const YYYY_MM = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM format');

/** TEXT primary keys (expense, trade, dividend); legacy rows may not be UUIDs. */
export const RECORD_ID = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid id');

export const ROW_UUID = z.uuid();
