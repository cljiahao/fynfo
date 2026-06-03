import { getSupabaseEnv } from '@/lib/constants/env';
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
