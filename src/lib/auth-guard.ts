// Thin facade — delegate to action-guard.requireDbContext to avoid duplicating
// the `supabase.auth.getUser()` verification logic across two modules.
import { requireDbContext } from '@/lib/action-guard';

export async function requireUserId(): Promise<string> {
  const { userId } = await requireDbContext();
  return userId;
}
