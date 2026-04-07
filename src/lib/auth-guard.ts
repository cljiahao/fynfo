import { auth } from '@/auth';

/**
 * Returns the authenticated user's ID or throws if not authenticated.
 * Use in server actions to scope data to the current user.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}
