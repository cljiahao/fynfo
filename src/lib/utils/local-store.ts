/**
 * SSR-safe localStorage helpers for small client-side UI preferences.
 * `loadLocal` returns the fallback on the server, on a parse error, or when the
 * key is absent. Not for sensitive data — vault payloads stay encrypted in
 * Postgres, never here.
 */
export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / disabled — preferences are best-effort
  }
}
