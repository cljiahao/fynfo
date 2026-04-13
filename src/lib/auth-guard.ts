import { createSupabaseServerClient } from '@/integrations/services/supabase';

/**
 * Returns the authenticated user's ID or throws if not authenticated.
 * Use in server actions to scope data to the current user.
 */
export async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error('Unauthorized');
  }

  return user.id;
}
