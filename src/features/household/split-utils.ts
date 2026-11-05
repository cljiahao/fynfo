import type { PlannerSplit } from './types';

/** Whole-number percent from a text field, or null when it is not 0 to 100. */
export function parsePct(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

export function partnerIdOf(split: PlannerSplit): string | null {
  return Object.keys(split.members).find((id) => id !== split.userId) ?? null;
}
