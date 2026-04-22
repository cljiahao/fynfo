import { createSupabaseServerClient } from '@/integrations/services/supabase';

export async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user.id;
}
