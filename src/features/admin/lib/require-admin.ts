import { createSupabaseServerClient } from '@/integrations/services/supabase';
import { isAdminEmail } from '@/lib/admin';
import { notFound } from 'next/navigation';

/**
 * Admin gate shared by every admin-only surface: requires an authenticated user
 * whose email is in ADMIN_EMAILS. Fails closed (unset allowlist -> 404 for
 * everyone) and answers 404 rather than 403 so the surface does not leak.
 */
export async function requireAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (
    userError ||
    !user ||
    !isAdminEmail(user.email, process.env.ADMIN_EMAILS)
  ) {
    notFound();
  }
}
