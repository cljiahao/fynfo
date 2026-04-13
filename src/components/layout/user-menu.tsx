import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { UserMenuDropdown } from './user-menu-dropdown';

export async function UserMenu() {
  let user;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return null;
  }

  if (!user) return null;

  return (
    <UserMenuDropdown
      name={user.user_metadata?.full_name ?? user.email?.split('@')[0]}
      email={user.email ?? undefined}
      image={user.user_metadata?.avatar_url ?? undefined}
    />
  );
}
