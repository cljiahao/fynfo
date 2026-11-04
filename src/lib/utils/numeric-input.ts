const DECIMAL_RE = /^(\d+\.?\d*|\.\d+)$/;

/** Parses a user-typed non-negative decimal; null when empty or not a finite number. */
export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!DECIMAL_RE.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
