export const isDev = process.env.NODE_ENV === 'development';

/**
 * Public Supabase connection env. References the literal `NEXT_PUBLIC_*` keys so
 * Next.js inlines them into the browser bundle at build time. Throws a clear,
 * named error if either is missing instead of masking it behind a `!` and
 * failing later with a cryptic message inside `@supabase/ssr`.
 */
export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );
  }
  return { url, key };
}
